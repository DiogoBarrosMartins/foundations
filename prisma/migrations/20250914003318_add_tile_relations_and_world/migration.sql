/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Tile` table. All the data in the column will be lost.
  - You are about to drop the column `outpostId` on the `Tile` table. All the data in the column will be lost.
  - You are about to drop the column `villageId` on the `Tile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tileId]` on the table `Outpost` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tileId]` on the table `Village` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "public"."TileType" ADD VALUE 'SHRINE';

-- DropForeignKey
ALTER TABLE "public"."Tile" DROP CONSTRAINT "Tile_outpostId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Tile" DROP CONSTRAINT "Tile_villageId_fkey";

-- DropIndex
DROP INDEX "public"."Tile_outpostId_key";

-- DropIndex
DROP INDEX "public"."Tile_villageId_key";

-- AlterTable
ALTER TABLE "public"."Outpost" ADD COLUMN     "tileId" TEXT;

-- AlterTable
ALTER TABLE "public"."Tile" DROP COLUMN "createdAt",
DROP COLUMN "outpostId",
DROP COLUMN "villageId",
ADD COLUMN     "worldId" TEXT;

-- AlterTable
ALTER TABLE "public"."Village" ADD COLUMN     "tileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Outpost_tileId_key" ON "public"."Outpost"("tileId");

-- CreateIndex
CREATE UNIQUE INDEX "Village_tileId_key" ON "public"."Village"("tileId");

-- AddForeignKey
ALTER TABLE "public"."Outpost" ADD CONSTRAINT "Outpost_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "public"."Tile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Village" ADD CONSTRAINT "Village_tileId_fkey" FOREIGN KEY ("tileId") REFERENCES "public"."Tile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tile" ADD CONSTRAINT "Tile_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "public"."World"("id") ON DELETE SET NULL ON UPDATE CASCADE;
