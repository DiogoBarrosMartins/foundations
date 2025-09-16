/*
  Warnings:

  - Made the column `startTime` on table `TrainingTask` required. This step will fail if there are existing NULL values in that column.
  - Made the column `endTime` on table `TrainingTask` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "public"."TrainingTask" ALTER COLUMN "startTime" SET NOT NULL,
ALTER COLUMN "endTime" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."World" ADD COLUMN     "seed" TEXT;
