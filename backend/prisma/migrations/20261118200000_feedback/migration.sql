-- Member feedback and complaints: a rating, a comment, and the gym's reply.

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "memberId" TEXT,
    "rating" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "response" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_gymId_status_idx" ON "Feedback"("gymId", "status");

-- CreateIndex
CREATE INDEX "Feedback_gymId_createdAt_idx" ON "Feedback"("gymId", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_memberId_idx" ON "Feedback"("memberId");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

