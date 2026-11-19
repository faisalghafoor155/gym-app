import type { Response } from 'express';
import prisma from '../db.js';
import { audit } from '../services/audit.js';
import {
  BROADCAST_TEMPLATES, MAX_RECIPIENTS, resolveAudience, runBroadcast, type BroadcastTemplate,
} from '../services/broadcasts.js';
import { messagingEnabled } from '../services/messaging.js';
import type { AuthedRequest } from '../types.js';
import type { BroadcastAudienceQuery, CreateBroadcastBody, IdParam } from '../schemas.js';

/**
 * Bulk WhatsApp: offers, new batches and closure notices sent to a group of
 * members or leads, and the log of what went to whom.
 */

/** The templates, for the composer to build its form and preview from. */
export const templates = (_req: AuthedRequest, res: Response): void => {
  res.json({
    templates: Object.entries(BROADCAST_TEMPLATES).map(([key, t]) => ({ key, label: t.label, fields: t.fields, body: t.body })),
    canSend: messagingEnabled(),
    maxRecipients: MAX_RECIPIENTS,
  });
};

/** How many an audience would reach, before anything is sent. */
export const audience = async (
  req: AuthedRequest<Record<string, string>, unknown, unknown, BroadcastAudienceQuery>,
  res: Response,
): Promise<void> => {
  try {
    const a = await resolveAudience(req.gymId, req.branchId, req.query.audience, req.query.inactiveDays);
    res.json({
      total: a.total,
      reachable: a.reachable.length,
      optedOut: a.optedOut,
      noNumber: a.noNumber,
      duplicates: a.duplicates,
      sample: a.reachable.slice(0, 5).map(r => r.name),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** Counts per status for each broadcast, read from its recipients. */
const countsFor = async (ids: string[]) => {
  const rows = await prisma.broadcastRecipient.groupBy({
    by: ['broadcastId', 'status'],
    where: { broadcastId: { in: ids } },
    _count: { _all: true },
  });
  return (id: string) => {
    const of = (s: string) => rows.find(r => r.broadcastId === id && r.status === s)?._count._all ?? 0;
    const sent = of('sent');
    const failed = of('failed');
    const skipped = of('skipped');
    const waiting = of('pending') + of('sending');
    return { total: sent + failed + skipped + waiting, sent, failed, skipped, waiting };
  };
};

/** The send log, newest first. */
export const list = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const rows = await prisma.broadcast.findMany({
      where: { gymId: req.gymId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const counts = await countsFor(rows.map(r => r.id));
    res.json(rows.map(r => ({ ...r, counts: counts(r.id) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/** One broadcast with everyone it went to, failures first. */
export const getOne = async (req: AuthedRequest<IdParam>, res: Response): Promise<void> => {
  try {
    const b = await prisma.broadcast.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      include: {
        createdBy: { select: { id: true, name: true } },
        recipients: { select: { id: true, name: true, phone: true, status: true, sentAt: true, memberId: true, leadId: true } },
      },
    });
    if (!b) {
      res.status(404).json({ error: 'Broadcast not found' });
      return;
    }
    const order: Record<string, number> = { failed: 0, skipped: 1, sending: 2, pending: 3, sent: 4 };
    const { recipients, ...rest } = b;
    res.json({
      ...rest,
      counts: (await countsFor([b.id]))(b.id),
      recipients: recipients.sort((x, y) => (order[x.status] ?? 9) - (order[y.status] ?? 9) || x.name.localeCompare(y.name)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Sends a broadcast: records everyone it is going to, answers at once, and
 * sends in the background. The log shows it filling in.
 */
export const create = async (
  req: AuthedRequest<Record<string, string>, unknown, CreateBroadcastBody>,
  res: Response,
): Promise<void> => {
  const { template, audience: who, inactiveDays, values } = req.body;
  try {
    if (!messagingEnabled()) {
      res.status(400).json({ error: 'WhatsApp is not set up on this install yet, so nothing can be sent' });
      return;
    }
    const fields = BROADCAST_TEMPLATES[template as BroadcastTemplate].fields;
    const missing = fields.find(f => !values[f.key]);
    if (missing) {
      res.status(400).json({ error: `${missing.label} is required` });
      return;
    }
    // One at a time: a second press while the first is still going would
    // message everybody twice.
    if (await prisma.broadcast.count({ where: { gymId: req.gymId, status: 'sending' } })) {
      res.status(409).json({ error: 'A broadcast is still being sent. Wait for it to finish first.' });
      return;
    }

    const a = await resolveAudience(req.gymId, req.branchId, who, inactiveDays);
    if (!a.reachable.length) {
      res.status(400).json({ error: 'Nobody in that group can be messaged on WhatsApp' });
      return;
    }
    if (a.reachable.length > MAX_RECIPIENTS) {
      res.status(400).json({ error: `That is ${a.reachable.length} people. A broadcast can go to ${MAX_RECIPIENTS} at most.` });
      return;
    }

    const kept = Object.fromEntries(fields.map(f => [f.key, values[f.key]!]));
    const b = await prisma.broadcast.create({
      data: {
        gymId: req.gymId,
        branchId: req.branchId ?? null,
        template,
        values: kept,
        audience: who,
        inactiveDays: who === 'inactive' ? inactiveDays : null,
        createdById: req.userId,
        recipients: {
          create: a.reachable.map(r => ({ memberId: r.memberId ?? null, leadId: r.leadId ?? null, name: r.name, phone: r.phone })),
        },
      },
    });
    await audit(req, {
      action: 'broadcast.send',
      entity: 'broadcast',
      entityId: b.id,
      entityLabel: `${BROADCAST_TEMPLATES[template as BroadcastTemplate].label} → ${who} (${a.reachable.length})`,
      after: { template, audience: who, values: kept, recipients: a.reachable.length },
    });
    void runBroadcast(b.id);
    res.status(201).json({ id: b.id, recipients: a.reachable.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
