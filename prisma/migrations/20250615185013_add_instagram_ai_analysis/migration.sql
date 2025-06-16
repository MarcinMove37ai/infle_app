-- AlterTable
ALTER TABLE "users" ADD COLUMN     "instagramUsername" TEXT;

-- CreateTable
CREATE TABLE "instagram_creator_ai_analysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "profileDescription" TEXT NOT NULL,
    "competencies" JSONB NOT NULL,
    "uniqueTalent" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "postsAnalyzed" INTEGER NOT NULL,
    "aiModel" TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
    "version" TEXT NOT NULL DEFAULT '2.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_creator_ai_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_creator_ai_analysis_userId_idx" ON "instagram_creator_ai_analysis"("userId");

-- CreateIndex
CREATE INDEX "instagram_creator_ai_analysis_username_idx" ON "instagram_creator_ai_analysis"("username");

-- CreateIndex
CREATE INDEX "instagram_creator_ai_analysis_userId_username_idx" ON "instagram_creator_ai_analysis"("userId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_creator_ai_analysis_userId_username_key" ON "instagram_creator_ai_analysis"("userId", "username");

-- AddForeignKey
ALTER TABLE "instagram_creator_ai_analysis" ADD CONSTRAINT "instagram_creator_ai_analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
