/** @format */

import type { Response } from "express";
import prisma from "../../db.js";
import { audit } from "../../services/audit.js";
import { deletePhoto } from "../../services/s3.js";
import type { AuthedRequest } from "../../types.js";
import type { IdParam } from "../../schemas.js";
import { memberFields } from "./shared.js";

export const remove = async (
  req: AuthedRequest<IdParam>,
  res: Response,
): Promise<void> => {
  const { id } = req.params;
  try {
    const existing = await prisma.member.findFirst({
      where: { id, gymId: req.gymId },
      select: memberFields,
    });
    if (!existing) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    // Delete photo from S3 if it exists
    if (existing.photoKey) {
      await deletePhoto(existing.photoKey);
    }

    // Every relation is ON DELETE RESTRICT, so children go first. The counts
    // go into the audit entry: how much history went with the member is the
    // part worth knowing afterwards.
    // In order, one after another: a payment intent and a PT session can both
    // point at a payment, and a payment at a membership.
    const removed = await prisma.$transaction(async (tx) => {
      const paymentIntents = await tx.paymentIntent.deleteMany({ where: { memberId: id } });
      const classBookings = await tx.classBooking.deleteMany({ where: { memberId: id } });
      const memberPlans = await tx.memberPlan.deleteMany({ where: { memberId: id } });
      const attendance = await tx.attendance.deleteMany({ where: { memberId: id } });
      const payments = await tx.payment.deleteMany({ where: { memberId: id } });
      const ptSessions = await tx.ptSession.deleteMany({ where: { memberId: id } });
      const memberships = await tx.membership.deleteMany({ where: { memberId: id } });
      await tx.member.delete({ where: { id } });
      return {
        memberPlans: memberPlans.count,
        attendance: attendance.count,
        payments: payments.count,
        memberships: memberships.count,
        ptSessions: ptSessions.count,
        classBookings: classBookings.count,
        paymentIntents: paymentIntents.count,
      };
    });

    await audit(req, {
      action: "member.delete",
      entity: "member",
      entityId: id,
      entityLabel: `${existing.memberNo} · ${existing.name}`,
      before: { ...existing, deletedWith: removed },
    });

    res.json({ message: "Member deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
