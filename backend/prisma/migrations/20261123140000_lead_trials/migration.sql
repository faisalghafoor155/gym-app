-- Free trial passes for leads, their visits, and the daily follow-up list.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "trialUntil" DATE;

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN "leadDigestSentOn" DATE;

-- CreateTable
CREATE TABLE "LeadVisit" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "branchId" TEXT,
    "visitedOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadVisit_leadId_visitedOn_key" ON "LeadVisit"("leadId", "visitedOn");

-- CreateIndex
CREATE INDEX "LeadVisit_gymId_visitedOn_idx" ON "LeadVisit"("gymId", "visitedOn");

-- AddForeignKey
ALTER TABLE "LeadVisit" ADD CONSTRAINT "LeadVisit_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
