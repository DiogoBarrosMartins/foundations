-- AlterTable
ALTER TABLE "public"."Building" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "queuedUntil" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'idle';

-- CreateTable
CREATE TABLE "public"."ConstructionTask" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "type" "public"."BuildingType" NOT NULL,
    "level" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionTask_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ConstructionTask" ADD CONSTRAINT "ConstructionTask_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "public"."Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConstructionTask" ADD CONSTRAINT "ConstructionTask_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
