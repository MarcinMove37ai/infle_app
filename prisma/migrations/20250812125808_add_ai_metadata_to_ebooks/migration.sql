-- AlterTable
ALTER TABLE "ebooks" ADD COLUMN     "ai_generation_timestamp" TIMESTAMP(6),
ADD COLUMN     "image_ai_model" VARCHAR(100),
ADD COLUMN     "image_ai_provider" VARCHAR(50),
ADD COLUMN     "text_ai_model" VARCHAR(100),
ADD COLUMN     "text_ai_provider" VARCHAR(50);
