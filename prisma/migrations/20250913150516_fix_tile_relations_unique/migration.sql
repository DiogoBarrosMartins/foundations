/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `race` on the `Player` table. All the data in the column will be lost.
  - You are about to drop the column `combatState` on the `Village` table. All the data in the column will be lost.
  - You are about to drop the column `playerName` on the `Village` table. All the data in the column will be lost.
  - Made the column `x` on table `Village` required. This step will fail if there are existing NULL values in that column.
  - Made the column `y` on table `Village` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."RaceName" AS ENUM ('HUMAN', 'ORC', 'ELF', 'DWARF', 'UNDEAD');

-- CreateEnum
CREATE TYPE "public"."BuildingType" AS ENUM ('SAWMILL', 'CLAY_PIT', 'IRON_MINE', 'FARM', 'WAREHOUSE', 'GRANARY', 'MARKET', 'BARRACKS', 'STABLE', 'WORKSHOP', 'WALL', 'TOWER', 'SMITHY', 'EMBASSY', 'ACADEMY', 'SHRINE');

-- CreateEnum
CREATE TYPE "public"."TileType" AS ENUM ('VILLAGE', 'OUTPOST', 'EMPTY', 'SHRINE');

-- DropIndex
DROP INDEX "public"."Player_email_key";

-- AlterTable
ALTER TABLE "public"."Player" DROP COLUMN "deletedAt",
DROP COLUMN "email",
DROP COLUMN "race",
ADD COLUMN     "raceId" TEXT;

-- AlterTable
ALTER TABLE "public"."Village" DROP COLUMN "combatState",
DROP COLUMN "playerName",
ALTER COLUMN "x" SET NOT NULL,
ALTER COLUMN "y" SET NOT NULL,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "public"."Race" (
    "id" TEXT NOT NULL,
    "name" "public"."RaceName" NOT NULL,
    "description" TEXT NOT NULL,
    "traits" JSONB NOT NULL,
    "hubX" INTEGER,
    "hubY" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Outpost" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outpost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Building" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "type" "public"."BuildingType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Troop" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "troopType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Troop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tile" (
    "id" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "type" "public"."TileType" NOT NULL,
    "race" "public"."RaceName",
    "villageId" TEXT,
    "outpostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Race_name_key" ON "public"."Race"("name");

-- CreateIndex
CREATE INDEX "Outpost_raceId_idx" ON "public"."Outpost"("raceId");

-- CreateIndex
CREATE UNIQUE INDEX "Building_villageId_type_key" ON "public"."Building"("villageId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Troop_villageId_troopType_key" ON "public"."Troop"("villageId", "troopType");

-- CreateIndex
CREATE UNIQUE INDEX "Tile_villageId_key" ON "public"."Tile"("villageId");

-- CreateIndex
CREATE UNIQUE INDEX "Tile_outpostId_key" ON "public"."Tile"("outpostId");

-- CreateIndex
CREATE UNIQUE INDEX "Tile_x_y_key" ON "public"."Tile"("x", "y");

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "public"."Race"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Village" ADD CONSTRAINT "Village_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Outpost" ADD CONSTRAINT "Outpost_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "public"."Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Building" ADD CONSTRAINT "Building_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Troop" ADD CONSTRAINT "Troop_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tile" ADD CONSTRAINT "Tile_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tile" ADD CONSTRAINT "Tile_outpostId_fkey" FOREIGN KEY ("outpostId") REFERENCES "public"."Outpost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
