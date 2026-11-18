-- Staff attendance: a row per staff member per day, the gym's weekly off and
-- absence-deduction settings, and the days recorded on each salary payment.

-- AlterTable
ALTER TABLE "Gym" ADD COLUMN     "staffAbsenceDeduction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "staffWeeklyOff" INTEGER;

-- AlterTable
ALTER TABLE "SalaryPayment" ADD COLUMN     "absenceDeduction" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "absentDays" DECIMAL(5,1) NOT NULL DEFAULT 0,
ADD COLUMN     "leaveDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "presentDays" DECIMAL(5,1) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'present',
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAttendance_gymId_day_idx" ON "StaffAttendance"("gymId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_staffMemberId_day_key" ON "StaffAttendance"("staffMemberId", "day");

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

