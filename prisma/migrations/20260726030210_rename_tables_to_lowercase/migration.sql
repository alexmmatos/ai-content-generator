-- Compatibility migration for databases created before the physical table names
-- were mapped to lowercase. On a clean install the initial migration already uses
-- the final names, so these blocks intentionally become no-ops.
DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL
    AND to_regclass('public."user"') IS NULL THEN
    ALTER TABLE "User" RENAME TO "user";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Content"') IS NOT NULL
    AND to_regclass('public."content"') IS NULL THEN
    ALTER TABLE "Content" RENAME TO "content";
  END IF;
END $$;
