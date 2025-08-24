-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'demo', 'free', 'payd', 'premium');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'free';
