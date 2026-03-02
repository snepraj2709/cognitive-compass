-- AlterTable
ALTER TABLE "UserStats"
ALTER COLUMN "weakestDimension" TYPE TEXT USING "weakestDimension"::TEXT,
ALTER COLUMN "strongestDimension" TYPE TEXT USING "strongestDimension"::TEXT;

-- AlterTable
ALTER TABLE "Profile" ALTER COLUMN "sortOrder" SET DEFAULT 0;

-- CreateIndex
CREATE INDEX "Profile_difficulty_idx" ON "Profile"("difficulty");

-- CreateIndex
CREATE INDEX "Profile_isActive_idx" ON "Profile"("isActive");

-- CreateIndex
CREATE INDEX "GameSession_userId_idx" ON "GameSession"("userId");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");
