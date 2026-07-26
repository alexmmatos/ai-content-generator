-- Keep enum values uppercase while normalizing only the PostgreSQL type name.
-- The conditional block supports both legacy databases and clean installations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ContentStatus'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'content_status'
  ) THEN
    ALTER TYPE "ContentStatus" RENAME TO "content_status";
  END IF;
END $$;
