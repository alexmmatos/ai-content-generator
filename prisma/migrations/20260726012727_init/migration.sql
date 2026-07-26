-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'PENDING',
    "result_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_user_id_idx" ON "content"("user_id");

-- AddForeignKey
ALTER TABLE "content" ADD CONSTRAINT "content_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
