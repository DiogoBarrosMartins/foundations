/*
  Warnings:

  - You are about to drop the column `resourceAmounts` on the `Village` table. All the data in the column will be lost.
  - You are about to drop the column `resourceProductionRates` on the `Village` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Village" ADD COLUMN     "foodAmount" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "woodAmount" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "stoneAmount" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "goldAmount" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "foodProductionRate" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "woodProductionRate" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "stoneProductionRate" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "goldProductionRate" INTEGER NOT NULL DEFAULT 8;

-- Migrate data from JSON fields to new columns
UPDATE "public"."Village"
SET
  "foodAmount" = (resourceAmounts->>'food')::INTEGER,
  "woodAmount" = (resourceAmounts->>'wood')::INTEGER,
  "stoneAmount" = (resourceAmounts->>'stone')::INTEGER,
  "goldAmount" = (resourceAmounts->>'gold')::INTEGER,
  "foodProductionRate" = (resourceProductionRates->>'food')::INTEGER,
  "woodProductionRate" = (resourceProductionRates->>'wood')::INTEGER,
  "stoneProductionRate" = (resourceProductionRates->>'stone')::INTEGER,
  "goldProductionRate" = (resourceProductionRates->>'gold')::INTEGER;

-- DropTable (actually drop columns)
ALTER TABLE "public"."Village" DROP COLUMN "resourceAmounts",
DROP COLUMN "resourceProductionRates";