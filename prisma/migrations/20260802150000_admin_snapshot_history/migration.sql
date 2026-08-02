ALTER TABLE "accounts" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "audit_logs"
SET "category" = 'PLAYER_SNAPSHOT'
WHERE "category" = 'TRANSACTION'
  AND "metadata" ? 'snapshot';

CREATE INDEX "audit_logs_category_timestamp_idx"
ON "audit_logs"("category", "timestamp" DESC);
