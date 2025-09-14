/*
  Warnings:

  - The values [SHRINE] on the enum `TileType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."TileType_new" AS ENUM ('EMPTY', 'VILLAGE', 'OUTPOST');
ALTER TABLE "public"."Tile" ALTER COLUMN "type" TYPE "public"."TileType_new" USING ("type"::text::"public"."TileType_new");
ALTER TYPE "public"."TileType" RENAME TO "TileType_old";
ALTER TYPE "public"."TileType_new" RENAME TO "TileType";
DROP TYPE "public"."TileType_old";
COMMIT;

-- DropIndex
DROP INDEX "public"."Tile_race_idx";

-- AlterTable
ALTER TABLE "public"."Tile" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "playerId" TEXT,
ADD COLUMN     "playerName" TEXT;

-- CreateTable
CREATE TABLE "public"."World" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "World_pkey" PRIMARY KEY ("id")
);
