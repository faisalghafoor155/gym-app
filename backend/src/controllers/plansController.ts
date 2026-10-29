import type { Response } from 'express';
import prisma from '../db.js';
import { audit } from '../services/audit.js';
import type { AuthedRequest } from '../types.js';
import type { CreatePlanBody, AssignPlanBody, IdParam } from '../schemas.js';

/** An assignment as read back: both plans, and the trainer by name only. */
export const planIncludes = {
  workoutPlan: true,
  dietPlan: true,
  trainer: { select: { id: true, name: true } },
} as const;

export const getWorkoutPlans = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const plans = await prisma.workoutPlan.findMany({
      where: { gymId: req.gymId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createWorkoutPlan = async (
  req: AuthedRequest<Record<string, string>, unknown, CreatePlanBody>,
  res: Response,
): Promise<void> => {
  const { name, description, workoutData } = req.body;
  try {
    const plan = await prisma.workoutPlan.create({
      data: { gymId: req.gymId, name, description, workoutData },
    });
    res.status(201).json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getDietPlans = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const plans = await prisma.dietPlan.findMany({
      where: { gymId: req.gymId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const createDietPlan = async (
  req: AuthedRequest<Record<string, string>, unknown, CreatePlanBody>,
  res: Response,
): Promise<void> => {
  const { name, description, dietData } = req.body;
  try {
    const plan = await prisma.dietPlan.create({
      data: { gymId: req.gymId, name, description, dietData },
    });
    res.status(201).json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const assignPlan = async (
  req: AuthedRequest<Record<string, string>, unknown, AssignPlanBody>,
  res: Response,
): Promise<void> => {
  const { memberId, workoutPlanId, dietPlanId, trainerId } = req.body;
  try {
    const member = await prisma.member.findFirst({ where: { id: memberId, gymId: req.gymId } });
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    // MemberPlan has no gymId of its own, so each plan id must be verified
    // against this gym or one gym could attach another gym's plan.
    if (workoutPlanId) {
      const plan = await prisma.workoutPlan.findFirst({
        where: { id: workoutPlanId, gymId: req.gymId },
      });
      if (!plan) {
        res.status(404).json({ error: 'Workout plan not found' });
        return;
      }
    }
    if (dietPlanId) {
      const plan = await prisma.dietPlan.findFirst({
        where: { id: dietPlanId, gymId: req.gymId },
      });
      if (!plan) {
        res.status(404).json({ error: 'Diet plan not found' });
        return;
      }
    }

    if (trainerId) {
      const trainer = await prisma.trainer.findFirst({
        where: { id: trainerId, gymId: req.gymId },
      });
      if (!trainer) {
        res.status(404).json({ error: 'Trainer not found' });
        return;
      }
    }

    // The member sees only their newest assignment, so a half left out here
    // is carried over from the last one — sending a diet must not take away
    // the workout they already have. An explicit null still clears it.
    const previous = await prisma.memberPlan.findFirst({
      where: { memberId },
      orderBy: { assignedAt: 'desc' },
    });

    const assignment = await prisma.memberPlan.create({
      data: {
        memberId,
        workoutPlanId: workoutPlanId === undefined ? previous?.workoutPlanId : workoutPlanId,
        dietPlanId: dietPlanId === undefined ? previous?.dietPlanId : dietPlanId,
        trainerId: trainerId ?? null,
      },
      include: planIncludes,
    });
    res.status(201).json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const getMemberPlans = async (
  req: AuthedRequest<IdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  try {
    // Scope through the member, since MemberPlan carries no gymId.
    const member = await prisma.member.findFirst({ where: { id, gymId: req.gymId } });
    if (!member) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const plans = await prisma.memberPlan.findMany({
      where: { memberId: id },
      include: planIncludes,
      orderBy: { assignedAt: 'desc' },
      take: 1,
    });
    res.json(plans[0] ?? null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Removes a workout or diet plan. Members it was assigned to keep their
 * assignment row with that half emptied — the relation is optional, so the
 * database sets it to null rather than refusing.
 */
const removePlan = (kind: 'workout' | 'diet') => async (
  req: AuthedRequest<IdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  try {
    const plan = kind === 'workout'
      ? await prisma.workoutPlan.findFirst({ where: { id, gymId: req.gymId } })
      : await prisma.dietPlan.findFirst({ where: { id, gymId: req.gymId } });
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.memberPlan.updateMany({
        where: kind === 'workout' ? { workoutPlanId: id } : { dietPlanId: id },
        data: kind === 'workout' ? { workoutPlanId: null } : { dietPlanId: null },
      });
      if (kind === 'workout') await tx.workoutPlan.delete({ where: { id } });
      else await tx.dietPlan.delete({ where: { id } });
    });
    await audit(req, {
      action: `plan.${kind}.delete`,
      entity: 'plan',
      entityId: id,
      entityLabel: plan.name,
      before: { name: plan.name },
    });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const deleteWorkoutPlan = removePlan('workout');
export const deleteDietPlan = removePlan('diet');
