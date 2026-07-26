-- AlterTable
ALTER TABLE "content"
ADD COLUMN "request_id" TEXT,
ADD COLUMN "request_hash" TEXT;

-- Backfill
UPDATE "content"
SET
  "request_id" = "id",
  "request_hash" = 'legacy:' || "id";

-- AlterTable
ALTER TABLE "content"
ALTER COLUMN "request_id" SET NOT NULL,
ALTER COLUMN "request_hash" SET NOT NULL;

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_request_id_key" ON "content"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_event_type_aggregate_id_key" ON "outbox_event"("type", "aggregate_id");

-- CreateIndex
CREATE INDEX "outbox_event_published_at_created_at_idx" ON "outbox_event"("published_at", "created_at");
