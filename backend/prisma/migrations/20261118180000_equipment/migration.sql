-- Equipment and maintenance: the machines a gym owns, their services and
-- fault reports, each cost booked as a linked "maintenance" expense.

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'strength',
    "brand" TEXT,
    "model" TEXT,
    "serialNo" TEXT,
    "location" TEXT,
    "purchasedOn" DATE,
    "cost" DECIMAL(10,2),
    "warrantyUntil" DATE,
    "serviceEveryDays" INTEGER,
    "lastServicedOn" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentService" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "servicedOn" DATE NOT NULL,
    "cost" DECIMAL(10,2),
    "vendor" TEXT,
    "notes" TEXT,
    "expenseId" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentFault" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "reportedById" TEXT,
    "reportedByMemberId" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fixedAt" TIMESTAMP(3),
    "fixNotes" TEXT,
    "repairCost" DECIMAL(10,2),
    "expenseId" TEXT,

    CONSTRAINT "EquipmentFault_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Equipment_gymId_isActive_idx" ON "Equipment"("gymId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentService_expenseId_key" ON "EquipmentService"("expenseId");

-- CreateIndex
CREATE INDEX "EquipmentService_equipmentId_servicedOn_idx" ON "EquipmentService"("equipmentId", "servicedOn");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentFault_expenseId_key" ON "EquipmentFault"("expenseId");

-- CreateIndex
CREATE INDEX "EquipmentFault_gymId_status_idx" ON "EquipmentFault"("gymId", "status");

-- CreateIndex
CREATE INDEX "EquipmentFault_equipmentId_idx" ON "EquipmentFault"("equipmentId");

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentService" ADD CONSTRAINT "EquipmentService_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentService" ADD CONSTRAINT "EquipmentService_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentService" ADD CONSTRAINT "EquipmentService_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentService" ADD CONSTRAINT "EquipmentService_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentFault" ADD CONSTRAINT "EquipmentFault_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentFault" ADD CONSTRAINT "EquipmentFault_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentFault" ADD CONSTRAINT "EquipmentFault_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentFault" ADD CONSTRAINT "EquipmentFault_reportedByMemberId_fkey" FOREIGN KEY ("reportedByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentFault" ADD CONSTRAINT "EquipmentFault_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

