-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authorDisplayName" TEXT,
ADD COLUMN     "authorLogoUrl" TEXT,
ADD COLUMN     "imageAiModel" TEXT DEFAULT 'dall-e-3',
ADD COLUMN     "imageAiProvider" TEXT DEFAULT 'openai',
ADD COLUMN     "textAiModel" TEXT DEFAULT 'claude-3-haiku',
ADD COLUMN     "textAiProvider" TEXT DEFAULT 'anthropic';

-- CreateTable
CREATE TABLE "user_api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ebook_chapters" (
    "id" SERIAL NOT NULL,
    "ebook_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "position" INTEGER NOT NULL,
    "image_url" VARCHAR(1024),
    "image_prompt" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ebook_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ebooks" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "draft_url" VARCHAR(255),
    "status" VARCHAR(50) DEFAULT 'draft',
    "visitors" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "x_amz_meta_user_id" INTEGER,
    "x_amz_meta_user_cognito_sub" VARCHAR(255),
    "x_amz_meta_user_first_name" VARCHAR(100),
    "x_amz_meta_user_last_name" VARCHAR(100),
    "x_amz_meta_user_email" VARCHAR(255),
    "x_amz_meta_user_role" VARCHAR(50),
    "x_amz_meta_user_status" VARCHAR(50),
    "x_amz_meta_user_supervisor_code" VARCHAR(100),
    "x_amz_meta_user_created_at" TIMESTAMP(6),
    "x_amz_meta_user_updated_at" TIMESTAMP(6),
    "category" VARCHAR(100),
    "short_desc" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "cover_image_url" TEXT,
    "cover_image_prompt" TEXT,
    "userId" TEXT,

    CONSTRAINT "ebooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_api_keys_userId_idx" ON "user_api_keys"("userId");

-- CreateIndex
CREATE INDEX "user_api_keys_provider_idx" ON "user_api_keys"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "user_api_keys_userId_provider_key" ON "user_api_keys"("userId", "provider");

-- CreateIndex
CREATE INDEX "idx_ebook_chapters_ebook_id" ON "ebook_chapters"("ebook_id");

-- CreateIndex
CREATE INDEX "idx_ebook_chapters_position" ON "ebook_chapters"("ebook_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ebooks_draft_url_key" ON "ebooks"("draft_url");

-- CreateIndex
CREATE INDEX "idx_ebooks_user_id" ON "ebooks"("x_amz_meta_user_id");

-- AddForeignKey
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ebook_chapters" ADD CONSTRAINT "ebook_chapters_ebook_id_fkey" FOREIGN KEY ("ebook_id") REFERENCES "ebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ebooks" ADD CONSTRAINT "ebooks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
