-- Installment plans: a membership's unpaid price split into parts with due dates.

-- AlterEnum
ALTER TYPE "ReminderKind" ADD VALUE 'installmentDue';

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN "blockOverdueInstallments" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Installment_membershipId_seq_key" ON "Installment"("membershipId", "seq");

-- CreateIndex
CREATE INDEX "Installment_gymId_dueDate_idx" ON "Installment"("gymId", "dueDate");

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
