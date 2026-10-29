-- A plan names the trainer it comes from, so the member sees who set it.
ALTER TABLE "MemberPlan" ADD COLUMN "trainerId" TEXT;

ALTER TABLE "MemberPlan" ADD CONSTRAINT "MemberPlan_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "Trainer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
