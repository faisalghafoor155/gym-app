-- Health declarations: a member's questionnaire and signed waiver, one row
-- per signing, plus the gym's waiver text and re-sign-on-renewal setting.

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "waiverOnRenewal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waiverText" TEXT;

-- CreateTable
CREATE TABLE "HealthDeclaration" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "conditions" TEXT[],
    "details" TEXT,
    "medications" TEXT,
    "waiverText" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signedName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "membershipId" TEXT,
    "recordedById" TEXT,

    CONSTRAINT "HealthDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthDeclaration_memberId_signedAt_idx" ON "HealthDeclaration"("memberId", "signedAt");

-- CreateIndex
CREATE INDEX "HealthDeclaration_gymId_idx" ON "HealthDeclaration"("gymId");

-- AddForeignKey
ALTER TABLE "HealthDeclaration" ADD CONSTRAINT "HealthDeclaration_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthDeclaration" ADD CONSTRAINT "HealthDeclaration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthDeclaration" ADD CONSTRAINT "HealthDeclaration_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

