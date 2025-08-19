-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('WEB', 'PDF');

-- CreateTable
CREATE TABLE "ebook_sources" (
    "id" SERIAL NOT NULL,
    "ebook_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "url" VARCHAR(1024) NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "content" TEXT NOT NULL,
    "sourceLabel" VARCHAR(100),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ebook_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ebook_sources_ebook_id_idx" ON "ebook_sources"("ebook_id");

-- CreateIndex
CREATE INDEX "ebook_sources_user_id_idx" ON "ebook_sources"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ebook_sources_ebook_id_url_key" ON "ebook_sources"("ebook_id", "url");

-- AddForeignKey
ALTER TABLE "ebook_sources" ADD CONSTRAINT "ebook_sources_ebook_id_fkey" FOREIGN KEY ("ebook_id") REFERENCES "ebooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ebook_sources" ADD CONSTRAINT "ebook_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
