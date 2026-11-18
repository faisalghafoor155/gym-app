-- Branches: a gym's locations. Members, staff, check-ins, expenses and day
-- passes can belong to one; everything that existed before is filed under
-- each gym's new main branch.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "allBranches" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "DayPass" ADD COLUMN     "branchId" TEXT;

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_gymId_idx" ON "Branch"("gymId");

-- CreateIndex
CREATE INDEX "Member_gymId_branchId_idx" ON "Member"("gymId", "branchId");

-- CreateIndex
CREATE INDEX "Attendance_branchId_checkedInAt_idx" ON "Attendance"("branchId", "checkedInAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPass" ADD CONSTRAINT "DayPass_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill: one main branch per gym, and every existing member, check-in,
-- expense and day pass filed under it. Staff accounts stay unassigned, which
-- means they see every branch, as they always have.
INSERT INTO "Branch" ("id", "gymId", "name", "isMain", "createdAt")
SELECT gen_random_uuid()::text, g."id", 'Main Branch', true, CURRENT_TIMESTAMP FROM "Gym" g;

UPDATE "Member" m SET "branchId" = b."id" FROM "Branch" b WHERE b."gymId" = m."gymId" AND b."isMain";
UPDATE "Attendance" a SET "branchId" = b."id" FROM "Branch" b WHERE b."gymId" = a."gymId" AND b."isMain";
UPDATE "Expense" e SET "branchId" = b."id" FROM "Branch" b WHERE b."gymId" = e."gymId" AND b."isMain";
UPDATE "DayPass" d SET "branchId" = b."id" FROM "Branch" b WHERE b."gymId" = d."gymId" AND b."isMain";
