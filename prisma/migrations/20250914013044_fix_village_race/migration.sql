/*
  Warnings:

  - You are about to drop the column `raceId` on the `Outpost` table. All the data in the column will be lost.
  - You are about to drop the column `raceId` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the `Race` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[email]` on the table `Player` will be added. If there are existing duplicate values, this will fail.
  - Made the column `race` on table `Village` required. This step will fail if there are existing NULL values in that column.

*/
-- Corrigir valores existentes antes de aplicar NOT NULL
UPDATE "Village" SET race = 'HUMAN' WHERE race IS NULL;

-- DropForeignKey
ALTER TABLE "public"."Outpost" DROP CONSTRAINT "Outpost_raceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Player" DROP CONSTRAINT "Player_raceId_fkey";

-- DropIndex
DROP INDEX "public"."Outpost_raceId_idx";

-- AlterTable
ALTER TABLE "public"."Outpost" DROP COLUMN "raceId",
ADD COLUMN     "race" "public"."RaceName" NOT NULL DEFAULT 'HUMAN';

-- AlterTable
ALTER TABLE "public"."Player" DROP COLUMN "raceId",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "race" "public"."RaceName" NOT NULL DEFAULT 'HUMAN';

ALTER TABLE "public"."Village" ALTER COLUMN "race" SET NOT NULL,
ALTER COLUMN "race" SET DEFAULT 'HUMAN';

-- DropTable
DROP TABLE "public"."Race";

-- CreateIndex
CREATE UNIQUE INDEX "unique_player_email" ON "public"."Player"("email");
