import type { Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../db.js';
import { audit } from '../services/audit.js';
import { gymDay } from '../services/dates.js';
import { withMoney } from '../services/money.js';
import type { AuthedRequest } from '../types.js';
import type {
  CreateEquipmentBody, FaultQuery, FixFaultBody, IdParam, RecordServiceBody, ReportFaultBody, UpdateEquipmentBody,
} from '../schemas.js';

/**
 * The gym's machines: what it owns, when each is due a service, and what is
 * broken.
 *
 * Money spent on them — a service, a repair — is booked as a "maintenance"
 * expense linked to the service or fault that caused it, so the profit report
 * sees it without anyone typing it in twice. Those expenses belong to this
 * page; the Expenses page will not edit or delete them.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** A service this close is "due soon" on the alerts. */
const DUE_SOON_DAYS = 7;

type ServiceState = 'none' | 'ok' | 'due_soon' | 'overdue';

/**
 * When the next service falls due, and how that compares with today.
 *
 * Counted from the last service, or from purchase (or the day it was added)
 * before the first one.
 */
const serviceDue = (
  e: { serviceEveryDays: number | null; lastServicedOn: Date | null; purchasedOn: Date | null; createdAt: Date },
  today: Date,
): { dueOn: Date | null; daysLeft: number | null; state: ServiceState } => {
  if (!e.serviceEveryDays) return { dueOn: null, daysLeft: null, state: 'none' };
  const from = e.lastServicedOn ?? e.purchasedOn ?? gymDay(e.createdAt);
  const dueOn = new Date(from.getTime() + e.serviceEveryDays * DAY_MS);
  const daysLeft = Math.round((dueOn.getTime() - today.getTime()) / DAY_MS);
  return { dueOn, daysLeft, state: daysLeft < 0 ? 'overdue' : daysLeft <= DUE_SOON_DAYS ? 'due_soon' : 'ok' };
};

const faultInclude = {
  equipment: { select: { id: true, name: true, location: true } },
  reportedBy: { select: { id: true, name: true } },
  reportedByMember: { select: { id: true, name: true, memberNo: true } },
} as const;

type EquipmentRow = Prisma.EquipmentGetPayload<{ include: { _count: { select: { faults: { where: { status: 'open' } } } } } }>;

const toView = (e: EquipmentRow, today: Date) => {
  const { _count, ...rest } = e;
  return {
    ...withMoney(rest, 'cost'),
    openFaults: _count.faults,
    service: serviceDue(e, today),
    underWarranty: !!e.warrantyUntil && e.warrantyUntil >= today,
  };
};

const openFaultCount = { _count: { select: { faults: { where: { status: 'open' } } } } } as const;

// --- the list ------------------------------------------------------------------

export const list = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const today = gymDay(new Date());
    const rows = await prisma.equipment.findMany({
      where: { gymId: req.gymId },
      include: openFaultCount,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    const data = rows.map((r) => toView(r, today));
    const active = data.filter((d) => d.isActive);
    res.json({
      data,
      totals: {
        machines: active.length,
        overdue: active.filter((d) => d.service.state === 'overdue').length,
        dueSoon: active.filter((d) => d.service.state === 'due_soon').length,
        openFaults: active.reduce((t, d) => t + d.openFaults, 0),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * What needs doing: services overdue or due within a week, and open faults.
 * For the dashboard card, so it stays small.
 */
export const alerts = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const today = gymDay(new Date());
    const [machines, faults] = await Promise.all([
      prisma.equipment.findMany({
        where: { gymId: req.gymId, isActive: true, serviceEveryDays: { not: null } },
        include: openFaultCount,
      }),
      prisma.equipmentFault.findMany({
        where: { gymId: req.gymId, status: 'open', equipment: { isActive: true } },
        include: faultInclude,
        orderBy: { reportedAt: 'asc' },
        take: 20,
      }),
    ]);
    const serviceDueList = machines
      .map((m) => ({ id: m.id, name: m.name, location: m.location, ...serviceDue(m, today) }))
      .filter((m) => m.state === 'overdue' || m.state === 'due_soon')
      .sort((a, b) => a.daysLeft! - b.daysLeft!);
    res.json({ serviceDue: serviceDueList, faults });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** One machine with its service and fault history. */
export const getOne = async (req: AuthedRequest<IdParam>, res: Response): Promise<void> => {
  try {
    const row = await prisma.equipment.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      include: {
        ...openFaultCount,
        services: {
          orderBy: { servicedOn: 'desc' },
          include: { recordedBy: { select: { id: true, name: true } } },
        },
        faults: { orderBy: { reportedAt: 'desc' }, include: faultInclude },
      },
    });
    if (!row) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }
    const { services, faults, ...machine } = row;
    res.json({
      ...toView(machine, gymDay(new Date())),
      services: services.map((s) => withMoney(s, 'cost')),
      faults: faults.map((f) => withMoney(f, 'repairCost')),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- adding and changing machines -------------------------------------------------

export const create = async (
  req: AuthedRequest<Record<string, string>, unknown, CreateEquipmentBody>,
  res: Response,
): Promise<void> => {
  try {
    const row = await prisma.equipment.create({
      data: { gymId: req.gymId, ...req.body },
      include: openFaultCount,
    });
    await audit(req, {
      action: 'equipment.create',
      entity: 'equipment',
      entityId: row.id,
      entityLabel: row.name,
      after: { name: row.name, category: row.category, cost: row.cost, serviceEveryDays: row.serviceEveryDays },
    });
    res.status(201).json(toView(row, gymDay(new Date())));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const update = async (
  req: AuthedRequest<IdParam, unknown, UpdateEquipmentBody>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await prisma.equipment.findFirst({ where: { id, gymId: req.gymId } });
    if (!existing) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }
    // Undefined leaves a field alone; null clears it.
    const data = Object.fromEntries(Object.entries(req.body).filter(([, v]) => v !== undefined));
    const row = await prisma.equipment.update({ where: { id }, data, include: openFaultCount });
    await audit(req, {
      action: 'equipment.update',
      entity: 'equipment',
      entityId: id,
      entityLabel: row.name,
      before: Object.fromEntries(Object.keys(data).map((k) => [k, existing[k as keyof typeof existing]])),
      after: data,
    });
    res.json(toView(row, gymDay(new Date())));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Only for a machine added by mistake. One with services or faults keeps its
 * history and is retired instead.
 */
export const remove = async (req: AuthedRequest<IdParam>, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await prisma.equipment.findFirst({
      where: { id, gymId: req.gymId },
      include: { _count: { select: { services: true, faults: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }
    if (existing._count.services > 0 || existing._count.faults > 0) {
      res.status(409).json({ error: 'This machine has a service or fault history. Retire it instead.' });
      return;
    }
    await prisma.equipment.delete({ where: { id } });
    await audit(req, {
      action: 'equipment.delete',
      entity: 'equipment',
      entityId: id,
      entityLabel: existing.name,
      before: { name: existing.name, category: existing.category, cost: existing.cost },
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- services ------------------------------------------------------------------------

/** The latest service left, after one is added or removed. */
const lastServiceOf = async (tx: Prisma.TransactionClient, equipmentId: string): Promise<Date | null> =>
  (await tx.equipmentService.findFirst({
    where: { equipmentId },
    orderBy: { servicedOn: 'desc' },
    select: { servicedOn: true },
  }))?.servicedOn ?? null;

export const recordService = async (
  req: AuthedRequest<IdParam, unknown, RecordServiceBody>,
  res: Response,
): Promise<void> => {
  const { servicedOn, cost, vendor, notes } = req.body;
  try {
    const machine = await prisma.equipment.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
    if (!machine) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }
    if (servicedOn > gymDay(new Date())) {
      res.status(400).json({ error: 'A service that has not happened yet cannot be recorded' });
      return;
    }

    const service = await prisma.$transaction(async (tx) => {
      const expense = cost
        ? await tx.expense.create({
          data: {
            gymId: req.gymId,
            category: 'maintenance',
            amount: cost,
            spentOn: servicedOn,
            vendor: vendor ?? machine.name,
            notes: `Service — ${machine.name}`,
            recordedById: req.userId,
          },
        })
        : null;
      const created = await tx.equipmentService.create({
        data: {
          gymId: req.gymId, equipmentId: machine.id, servicedOn, cost: cost || null, vendor, notes,
          expenseId: expense?.id ?? null, recordedById: req.userId,
        },
      });
      await tx.equipment.update({ where: { id: machine.id }, data: { lastServicedOn: await lastServiceOf(tx, machine.id) } });
      return created;
    });

    await audit(req, {
      action: 'equipment.service',
      entity: 'equipment',
      entityId: machine.id,
      entityLabel: machine.name,
      after: { servicedOn, cost, vendor },
    });
    res.status(201).json(withMoney(service, 'cost'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Removes a service entered by mistake, with its expense. */
export const removeService = async (req: AuthedRequest<IdParam>, res: Response): Promise<void> => {
  try {
    const service = await prisma.equipmentService.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      include: { equipment: { select: { name: true } } },
    });
    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.equipmentService.delete({ where: { id: service.id } });
      if (service.expenseId) await tx.expense.delete({ where: { id: service.expenseId } });
      await tx.equipment.update({
        where: { id: service.equipmentId },
        data: { lastServicedOn: await lastServiceOf(tx, service.equipmentId) },
      });
    });
    await audit(req, {
      action: 'equipment.service.delete',
      entity: 'equipment',
      entityId: service.equipmentId,
      entityLabel: service.equipment.name,
      before: { servicedOn: service.servicedOn, cost: service.cost, vendor: service.vendor },
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- faults ----------------------------------------------------------------------------

export const listFaults = async (
  req: AuthedRequest<Record<string, string>, unknown, unknown, FaultQuery>,
  res: Response,
): Promise<void> => {
  try {
    const faults = await prisma.equipmentFault.findMany({
      where: { gymId: req.gymId, ...(req.query.status !== 'all' && { status: req.query.status }) },
      include: faultInclude,
      orderBy: { reportedAt: 'desc' },
      take: 200,
    });
    res.json(faults.map((f) => withMoney(f, 'repairCost')));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Reports a fault. Shared by staff and by members from the portal — the caller
 * passes who it was.
 */
const createFault = async (
  gymId: string,
  body: ReportFaultBody,
  by: { reportedById?: string; reportedByMemberId?: string },
) => {
  const machine = await prisma.equipment.findFirst({
    where: { id: body.equipmentId, gymId, isActive: true },
    select: { id: true, name: true },
  });
  if (!machine) return null;
  const fault = await prisma.equipmentFault.create({
    data: { gymId, equipmentId: machine.id, description: body.description, ...by },
    include: faultInclude,
  });
  return { machine, fault };
};

export const reportFault = async (
  req: AuthedRequest<Record<string, string>, unknown, ReportFaultBody>,
  res: Response,
): Promise<void> => {
  try {
    const made = await createFault(req.gymId, req.body, { reportedById: req.userId });
    if (!made) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }
    await audit(req, {
      action: 'equipment.fault',
      entity: 'equipment',
      entityId: made.machine.id,
      entityLabel: made.machine.name,
      after: { description: req.body.description },
    });
    res.status(201).json(withMoney(made.fault, 'repairCost'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const fixFault = async (
  req: AuthedRequest<IdParam, unknown, FixFaultBody>,
  res: Response,
): Promise<void> => {
  const { fixNotes, repairCost } = req.body;
  try {
    const fault = await prisma.equipmentFault.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      include: { equipment: { select: { name: true } } },
    });
    if (!fault) {
      res.status(404).json({ error: 'Fault not found' });
      return;
    }
    if (fault.status === 'fixed') {
      res.status(409).json({ error: 'Already marked fixed' });
      return;
    }
    const now = new Date();
    const fixed = await prisma.$transaction(async (tx) => {
      const expense = repairCost
        ? await tx.expense.create({
          data: {
            gymId: req.gymId,
            category: 'maintenance',
            amount: repairCost,
            spentOn: now,
            vendor: fault.equipment.name,
            notes: `Repair — ${fault.equipment.name}: ${fault.description}`.slice(0, 300),
            recordedById: req.userId,
          },
        })
        : null;
      return tx.equipmentFault.update({
        where: { id: fault.id },
        data: {
          status: 'fixed', fixedAt: now, fixNotes, repairCost: repairCost || null, expenseId: expense?.id ?? null,
        },
        include: faultInclude,
      });
    });
    await audit(req, {
      action: 'equipment.fix',
      entity: 'equipment',
      entityId: fault.equipmentId,
      entityLabel: fault.equipment.name,
      after: { description: fault.description, repairCost, fixNotes },
    });
    res.json(withMoney(fixed, 'repairCost'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Removes a fault reported by mistake, and its repair expense if it had one. */
export const removeFault = async (req: AuthedRequest<IdParam>, res: Response): Promise<void> => {
  try {
    const fault = await prisma.equipmentFault.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      include: { equipment: { select: { name: true } } },
    });
    if (!fault) {
      res.status(404).json({ error: 'Fault not found' });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.equipmentFault.delete({ where: { id: fault.id } });
      if (fault.expenseId) await tx.expense.delete({ where: { id: fault.expenseId } });
    });
    await audit(req, {
      action: 'equipment.fault.delete',
      entity: 'equipment',
      entityId: fault.equipmentId,
      entityLabel: fault.equipment.name,
      before: { description: fault.description, status: fault.status, repairCost: fault.repairCost },
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// --- the member portal -------------------------------------------------------------------

/** The working machines a member can pick from to report one. Names only. */
export const listForMember = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const rows = await prisma.equipment.findMany({
      where: { gymId: req.gymId, isActive: true },
      select: { id: true, name: true, location: true },
      orderBy: { name: 'asc' },
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const reportFaultAsMember = async (
  req: AuthedRequest<Record<string, string>, unknown, ReportFaultBody>,
  res: Response,
): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { memberId: true } });
    if (!user?.memberId) {
      res.status(403).json({ error: 'Only a member account can report from the portal' });
      return;
    }
    const made = await createFault(req.gymId, req.body, { reportedByMemberId: user.memberId });
    if (!made) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }
    res.status(201).json({ id: made.fault.id, equipment: made.machine.name, status: made.fault.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
