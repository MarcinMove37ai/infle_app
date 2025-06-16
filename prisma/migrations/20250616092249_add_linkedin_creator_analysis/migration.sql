-- CreateTable
CREATE TABLE "linkedin_creator_analysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "postUrn" TEXT NOT NULL,
    "postDate" TEXT NOT NULL,
    "postText" TEXT NOT NULL,
    "totalReactions" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "commenterHeadlines" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linkedin_creator_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linkedin_creator_analysis_userId_idx" ON "linkedin_creator_analysis"("userId");

-- CreateIndex
CREATE INDEX "linkedin_creator_analysis_username_idx" ON "linkedin_creator_analysis"("username");

-- CreateIndex
CREATE INDEX "linkedin_creator_analysis_postUrn_idx" ON "linkedin_creator_analysis"("postUrn");

-- CreateIndex
CREATE UNIQUE INDEX "linkedin_creator_analysis_userId_postUrn_key" ON "linkedin_creator_analysis"("userId", "postUrn");

-- AddForeignKey
ALTER TABLE "linkedin_creator_analysis" ADD CONSTRAINT "linkedin_creator_analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
