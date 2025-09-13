-- AlterTable
ALTER TABLE "public"."Battle" ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Village" ADD COLUMN     "playerName" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."ArmyMovement" (
    "id" TEXT NOT NULL,
    "villageId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "originX" INTEGER NOT NULL,
    "originY" INTEGER NOT NULL,
    "targetX" INTEGER NOT NULL,
    "targetY" INTEGER NOT NULL,
    "troops" JSONB NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArmyMovement_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ArmyMovement" ADD CONSTRAINT "ArmyMovement_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "public"."Village"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
