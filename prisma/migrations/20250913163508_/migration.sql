/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Troop` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Troop` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[villageId,troopType,status]` on the table `Troop` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Building_villageId_type_key";

-- DropIndex
DROP INDEX "public"."Troop_villageId_troopType_key";

-- AlterTable
ALTER TABLE "public"."ConstructionTask" ALTER COLUMN "startTime" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "endTime" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Troop" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'idle';

-- CreateTable
CREATE TABLE "public"."TrainingTask" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "troopId" TEXT NOT NULL,
    "troopType" TEXT NOT NULL,
    "buildingType" "public"."BuildingType" NOT NULL,
    "count" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "queueJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tile_race_idx" ON "public"."Tile"("race");

-- CreateIndex
CREATE UNIQUE INDEX "Troop_villageId_troopType_status_key" ON "public"."Troop"("villageId", "troopType", "status");

-- AddForeignKey
ALTER TABLE "public"."TrainingTask" ADD CONSTRAINT "TrainingTask_troopId_fkey" FOREIGN KEY ("troopId") REFERENCES "public"."Troop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingTask" ADD CONSTRAINT "TrainingTask_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
