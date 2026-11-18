import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../db.js';
import { audit } from '../services/audit.js';
import { gymDay } from '../services/dates.js';
import {
  currentMonth, monthEnd, monthKey, monthStart, summarise,
} from '../services/staffAttendance.js';
import type { AuthedRequest } from '../types.js';
import type {
  MarkStaffAttendanceBody, SalaryMonthQuery, StaffCheckBody, StaffDayQuery,
} from '../schemas.js';

/**
 * Staff attendance: who came in today and when they left, and the month's
 * register the salary sheet counts days from.
 *
 * The desk checks staff in and out with one tap, like members. Correcting a
 * past day — a forgotten check-in, a leave — is a change to someone's pay, so
 * it is the salary permission's job, and it stops once that month is paid.
 */

const rowSelect = {
  id: true, day: true, status: true, checkInAt: true, checkOutAt: true, notes: true,
} as const;

/** Anyone on the staff who had joined by `day`. */
const staffOn = (gymId: string, day: Date) => ({
  gymId,
  isActive: true,
  OR: [{ joinedOn: null }, { joinedOn: { lte: day } }],
});

const findStaff = (gymId: string, id: string) =>
  prisma.staffMember.findFirst({ where: { id, gymId }, select: { id: true, name: true } });

/** One day's list: every staff member, with their row if they have one. */
export const getDay = async (
  req: AuthedRequest<Record<string, string>, unknown, unknown, StaffDayQuery>,
  res: Response,
): Promise<void> => {
  const day = gymDay(req.query.day ?? new Date());
  try {
    const staff = await prisma.staffMember.findMany({
      where: staffOn(req.gymId, day),
      select: {
        id: true, name: true, role: true, phone: true,
        attendance: { where: { day }, select: rowSelect },
      },
      orderBy: { name: 'asc' },
    });
    const rows = staff.map(({ attendance, ...person }) => ({ staffMember: person, record: attendance[0] ?? null }));
    res.json({
      day: day.toISOString().slice(0, 10),
      rows,
      totals: {
        staff: rows.length,
        in: rows.filter((r) => r.record && r.record.status !== 'leave' && !r.record.checkOutAt).length,
        present: rows.filter((r) => r.record && r.record.status !== 'leave').length,
        leave: rows.filter((r) => r.record?.status === 'leave').length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const checkIn = async (
  req: AuthedRequest<Record<string, string>, unknown, StaffCheckBody>,
  res: Response,
): Promise<void> => {
  const now = new Date();
  const day = gymDay(now);
  try {
    const person = await findStaff(req.gymId, req.body.staffMemberId);
    if (!person) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }

    const existing = await prisma.staffAttendance.findUnique({
      where: { staffMemberId_day: { staffMemberId: person.id, day } },
      select: rowSelect,
    });
    // Already in: the desk's intent is satisfied, so answer with the first
    // check-in rather than an error, as member check-in does.
    if (existing && existing.status !== 'leave') {
      res.json(existing);
      return;
    }

    // Marked on leave but turned up after all: they are present.
    const record = await prisma.staffAttendance.upsert({
      where: { staffMemberId_day: { staffMemberId: person.id, day } },
      create: {
        gymId: req.gymId, staffMemberId: person.id, day, status: 'present', checkInAt: now, recordedById: req.userId,
      },
      update: { status: 'present', checkInAt: now, recordedById: req.userId },
      select: rowSelect,
    });
    res.status(201).json(record);
  } catch (err) {
    // Two taps at once: the unique key keeps one, and the other reads it back.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const record = await prisma.staffAttendance.findUnique({
        where: { staffMemberId_day: { staffMemberId: req.body.staffMemberId, day } },
        select: rowSelect,
      });
      res.json(record);
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const checkOut = async (
  req: AuthedRequest<Record<string, string>, unknown, StaffCheckBody>,
  res: Response,
): Promise<void> => {
  const now = new Date();
  const day = gymDay(now);
  try {
    const existing = await prisma.staffAttendance.findFirst({
      where: { staffMemberId: req.body.staffMemberId, gymId: req.gymId, day },
    });
    if (!existing || existing.status === 'leave') {
      res.status(409).json({ error: 'Not checked in today' });
      return;
    }
    const record = await prisma.staffAttendance.update({
      where: { id: existing.id },
      data: { checkOutAt: now },
      select: rowSelect,
    });
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Sets a day by hand: present, a half day, leave, or absent (which clears it).
 *
 * For the past and today only — a leave booked ahead can be marked on the
 * day. Refused once the month is paid, because the slip already counts it.
 */
export const mark = async (
  req: AuthedRequest<Record<string, string>, unknown, MarkStaffAttendanceBody>,
  res: Response,
): Promise<void> => {
  const { staffMemberId, status } = req.body;
  const day = gymDay(req.body.day);
  try {
    const person = await findStaff(req.gymId, staffMemberId);
    if (!person) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }
    if (day > gymDay(new Date())) {
      res.status(400).json({ error: 'A day that has not come yet cannot be marked' });
      return;
    }
    const month = monthStart(monthKey(day));
    const paid = await prisma.salaryPayment.findUnique({
      where: { staffMemberId_month: { staffMemberId, month } },
      select: { id: true },
    });
    if (paid) {
      res.status(409).json({ error: 'This month is already paid. Undo the payment first to change it.' });
      return;
    }

    const before = await prisma.staffAttendance.findUnique({
      where: { staffMemberId_day: { staffMemberId, day } },
      select: { status: true },
    });

    let record = null;
    if (status === 'absent') {
      await prisma.staffAttendance.deleteMany({ where: { staffMemberId, day } });
    } else {
      record = await prisma.staffAttendance.upsert({
        where: { staffMemberId_day: { staffMemberId, day } },
        create: { gymId: req.gymId, staffMemberId, day, status, recordedById: req.userId },
        update: { status, recordedById: req.userId },
        select: rowSelect,
      });
    }

    await audit(req, {
      action: 'staffAttendance.mark',
      entity: 'staffMember',
      entityId: staffMemberId,
      entityLabel: `${person.name} · ${day.toISOString().slice(0, 10)}`,
      before: { status: before?.status ?? 'absent' },
      after: { status },
    });

    res.json({ day: day.toISOString().slice(0, 10), status, record });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** The month's register: each person's marked days and what they add up to. */
export const getMonth = async (
  req: AuthedRequest<Record<string, string>, unknown, unknown, SalaryMonthQuery>,
  res: Response,
): Promise<void> => {
  const key = req.query.month ?? currentMonth();
  const month = monthStart(key);
  const end = monthEnd(month);
  try {
    const [gym, staff] = await Promise.all([
      prisma.gym.findUniqueOrThrow({ where: { id: req.gymId }, select: { staffWeeklyOff: true } }),
      prisma.staffMember.findMany({
        where: {
          gymId: req.gymId,
          AND: [
            { OR: [{ joinedOn: null }, { joinedOn: { lte: end } }] },
            { OR: [{ isActive: true }, { attendance: { some: { day: { gte: month, lte: end } } } }] },
          ],
        },
        select: {
          id: true, name: true, role: true, joinedOn: true, isActive: true,
          attendance: { where: { day: { gte: month, lte: end } }, select: { day: true, status: true } },
          payments: { where: { month }, select: { id: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      month: key,
      weeklyOff: gym.staffWeeklyOff,
      rows: staff.map(({ attendance, payments, ...person }) => ({
        staffMember: person,
        paid: payments.length > 0,
        days: Object.fromEntries(attendance.map((a) => [a.day.toISOString().slice(0, 10), a.status])),
        summary: summarise(month, attendance, { joinedOn: person.joinedOn, weeklyOff: gym.staffWeeklyOff }),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
