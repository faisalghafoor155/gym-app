-- Day passes: one day's entry for a walk-in or a member's guest, and the
-- gym's default price and guest limit for them.

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "dayPassFee" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "guestPassesPerMonth" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DayPass" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'cash',
    "channel" TEXT,
    "reference" TEXT,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hostMemberId" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayPass_gymId_visitedAt_idx" ON "DayPass"("gymId", "visitedAt");

-- CreateIndex
CREATE INDEX "DayPass_hostMemberId_visitedAt_idx" ON "DayPass"("hostMemberId", "visitedAt");

-- AddForeignKey
ALTER TABLE "DayPass" ADD CONSTRAINT "DayPass_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPass" ADD CONSTRAINT "DayPass_hostMemberId_fkey" FOREIGN KEY ("hostMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPass" ADD CONSTRAINT "DayPass_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

