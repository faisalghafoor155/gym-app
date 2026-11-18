import type { Response } from 'express';
import prisma from '../db.js';
import { audit } from '../services/audit.js';
import { currentMembershipWhere } from '../services/membership.js';
import { waiverFor } from '../services/waiver.js';
import type { AuthedRequest } from '../types.js';
import type { CreateHealthDeclarationBody, IdParam } from '../schemas.js';

/**
 * A member's health declaration and signed waiver.
 *
 * Each signing is kept: the newest is what a trainer reads today, and the
 * older ones are what the member declared before. Nothing here edits or
 * deletes one — a signed statement that could be changed afterwards would not
 * be worth having signed.
 */

const declarationSelect = {
  id: true, conditions: true, details: true, medications: true, waiverText: true,
  signature: true, signedName: true, signedAt: true, membershipId: true,
  recordedBy: { select: { id: true, name: true } },
} as const;

/**
 * Whether the member should be asked to sign now: they never have, or the gym
 * asks again on renewal and the membership they are on began after they last
 * signed.
 */
const needsSigning = (
  last: { signedAt: Date } | null,
  current: { createdAt: Date } | null,
  onRenewal: boolean,
): boolean => {
  if (!last) return true;
  if (!onRenewal || !current) return false;
  return last.signedAt < current.createdAt;
};

export const getForMember = async (
  req: AuthedRequest<IdParam>,
  res: Response,
): Promise<void> => {
  try {
    const member = await prisma.member.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      select: {
        id: true, name: true,
        healthDeclarations: { select: declarationSelect, orderBy: { signedAt: 'desc' } },
        memberships: {
          where: currentMembershipWhere,
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    const gym = await prisma.gym.findUniqueOrThrow({
      where: { id: req.gymId },
      select: { waiverText: true, waiverOnRenewal: true },
    });
    const [current = null, ...history] = member.healthDeclarations;
    res.json({
      current,
      history,
      waiverText: waiverFor(gym),
      needsSigning: needsSigning(current, member.memberships[0] ?? null, gym.waiverOnRenewal),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createForMember = async (
  req: AuthedRequest<IdParam, unknown, CreateHealthDeclarationBody>,
  res: Response,
): Promise<void> => {
  const { conditions, details, medications, signedName, signature } = req.body;
  try {
    const member = await prisma.member.findFirst({
      where: { id: req.params.id, gymId: req.gymId },
      select: {
        id: true, name: true,
        memberships: { where: currentMembershipWhere, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } },
      },
    });
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    const gym = await prisma.gym.findUniqueOrThrow({ where: { id: req.gymId }, select: { waiverText: true } });

    const declaration = await prisma.healthDeclaration.create({
      data: {
        gymId: req.gymId,
        memberId: member.id,
        conditions,
        details,
        medications,
        // The wording as it reads now, frozen with the signature.
        waiverText: waiverFor(gym),
        signature,
        signedName,
        membershipId: member.memberships[0]?.id ?? null,
        recordedById: req.userId,
      },
      select: declarationSelect,
    });

    // The signature itself stays out of the log: it is an image, and the row
    // it belongs to is never changed.
    await audit(req, {
      action: 'health.sign',
      entity: 'member',
      entityId: member.id,
      entityLabel: member.name,
      after: { conditions, signedName },
    });

    res.status(201).json(declaration);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
