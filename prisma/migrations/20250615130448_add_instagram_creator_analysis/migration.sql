-- CreateTable
CREATE TABLE "instagram_creator_analysis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "videoPlayCount" INTEGER,
    "videoDuration" INTEGER,
    "commenterUsernames" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_creator_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_creator_analysis_userId_idx" ON "instagram_creator_analysis"("userId");

-- CreateIndex
CREATE INDEX "instagram_creator_analysis_username_idx" ON "instagram_creator_analysis"("username");

-- CreateIndex
CREATE INDEX "instagram_creator_analysis_postId_idx" ON "instagram_creator_analysis"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_creator_analysis_userId_postId_key" ON "instagram_creator_analysis"("userId", "postId");

-- AddForeignKey
ALTER TABLE "instagram_creator_analysis" ADD CONSTRAINT "instagram_creator_analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
