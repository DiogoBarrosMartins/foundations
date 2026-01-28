/*
  Warnings:

  - You are about to drop the column `resourceAmounts` on the `Village` table. All the data in the column will be lost.
  - You are about to drop the column `resourceProductionRates` on the `Village` table. All the data in the column will be lost.

*/
-- AlterTable: Add new columns with defaults
ALTER TABLE "public"."Village" ADD COLUMN IF NOT EXISTS "foodAmount" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS "woodAmount" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS "stoneAmount" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS "goldAmount" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS "foodProductionRate" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS "woodProductionRate" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS "stoneProductionRate" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS "goldProductionRate" INTEGER NOT NULL DEFAULT 8;

-- Migrate data from JSON fields to new columns (only if old columns exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'Village'
    AND column_name = 'resourceAmounts'
  ) THEN
    UPDATE "public"."Village"
    SET
      "foodAmount" = COALESCE((resourceAmounts->>'food')::INTEGER, 500),
      "woodAmount" = COALESCE((resourceAmounts->>'wood')::INTEGER, 500),
      "stoneAmount" = COALESCE((resourceAmounts->>'stone')::INTEGER, 500),
      "goldAmount" = COALESCE((resourceAmounts->>'gold')::INTEGER, 500);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'Village'
    AND column_name = 'resourceProductionRates'
  ) THEN
    UPDATE "public"."Village"
    SET
      "foodProductionRate" = COALESCE((resourceProductionRates->>'food')::INTEGER, 10),
      "woodProductionRate" = COALESCE((resourceProductionRates->>'wood')::INTEGER, 10),
      "stoneProductionRate" = COALESCE((resourceProductionRates->>'stone')::INTEGER, 10),
      "goldProductionRate" = COALESCE((resourceProductionRates->>'gold')::INTEGER, 8);
  END IF;
END $$;

-- Drop old columns if they exist
ALTER TABLE "public"."Village" DROP COLUMN IF EXISTS "resourceAmounts";
ALTER TABLE "public"."Village" DROP COLUMN IF EXISTS "resourceProductionRates";
