-- CreateEnum
CREATE TYPE "SocialProfileType" AS ENUM ('INSTAGRAM_ONLY', 'LINKEDIN_ONLY', 'BOTH', 'NONE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "instagramProfileId" TEXT,
ADD COLUMN     "linkedinProfileId" TEXT,
ADD COLUMN     "socialProfileType" "SocialProfileType" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "instagram_profile_checks" (
    "id" TEXT NOT NULL,
    "instagramUrl" TEXT NOT NULL,
    "instagramId" TEXT,
    "username" TEXT NOT NULL,
    "fullName" TEXT,
    "biography" TEXT,
    "followersCount" INTEGER,
    "followsCount" INTEGER,
    "postsCount" INTEGER,
    "profilePicUrl" TEXT,
    "profilePicUrlHD" TEXT,
    "isBusinessAccount" BOOLEAN NOT NULL DEFAULT false,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "businessCategory" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userIp" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "instagram_profile_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedin_profile_checks" (
    "id" TEXT NOT NULL,
    "linkedinUrl" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "fullName" TEXT,
    "headline" TEXT,
    "aboutExcerpt" TEXT,
    "connectionsCount" INTEGER,
    "followersCount" INTEGER,
    "profilePicUrl" TEXT,
    "jobTitle" TEXT,
    "companyName" TEXT,
    "companyIndustry" TEXT,
    "location" TEXT,
    "topSkills" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userIp" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "linkedin_profile_checks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_instagramProfileId_fkey" FOREIGN KEY ("instagramProfileId") REFERENCES "instagram_profile_checks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_linkedinProfileId_fkey" FOREIGN KEY ("linkedinProfileId") REFERENCES "linkedin_profile_checks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
