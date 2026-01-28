-- Performance indexes for MMO game server
-- These are additive/non-destructive and safe for production deployment

-- Village indexes
CREATE INDEX IF NOT EXISTS "Village_playerId_idx" ON "Village"("playerId");
CREATE INDEX IF NOT EXISTS "Village_x_y_idx" ON "Village"("x", "y");

-- Tile indexes
CREATE INDEX IF NOT EXISTS "Tile_worldId_idx" ON "Tile"("worldId");
CREATE INDEX IF NOT EXISTS "Tile_type_idx" ON "Tile"("type");
CREATE INDEX IF NOT EXISTS "Tile_race_idx" ON "Tile"("race");

-- Building indexes
CREATE INDEX IF NOT EXISTS "Building_villageId_idx" ON "Building"("villageId");
CREATE INDEX IF NOT EXISTS "Building_villageId_type_idx" ON "Building"("villageId", "type");
CREATE INDEX IF NOT EXISTS "Building_status_idx" ON "Building"("status");

-- ConstructionTask indexes
CREATE INDEX IF NOT EXISTS "ConstructionTask_villageId_idx" ON "ConstructionTask"("villageId");
CREATE INDEX IF NOT EXISTS "ConstructionTask_villageId_status_idx" ON "ConstructionTask"("villageId", "status");
CREATE INDEX IF NOT EXISTS "ConstructionTask_buildingId_idx" ON "ConstructionTask"("buildingId");

-- TrainingTask indexes
CREATE INDEX IF NOT EXISTS "TrainingTask_villageId_idx" ON "TrainingTask"("villageId");
CREATE INDEX IF NOT EXISTS "TrainingTask_villageId_status_idx" ON "TrainingTask"("villageId", "status");
CREATE INDEX IF NOT EXISTS "TrainingTask_villageId_buildingType_status_idx" ON "TrainingTask"("villageId", "buildingType", "status");
CREATE INDEX IF NOT EXISTS "TrainingTask_status_endTime_idx" ON "TrainingTask"("status", "endTime");

-- Battle indexes
CREATE INDEX IF NOT EXISTS "Battle_attackerVillageId_idx" ON "Battle"("attackerVillageId");
CREATE INDEX IF NOT EXISTS "Battle_defenderVillageId_idx" ON "Battle"("defenderVillageId");
CREATE INDEX IF NOT EXISTS "Battle_status_idx" ON "Battle"("status");
CREATE INDEX IF NOT EXISTS "Battle_status_arrivalTime_idx" ON "Battle"("status", "arrivalTime");

-- ArmyMovement indexes
CREATE INDEX IF NOT EXISTS "ArmyMovement_villageId_idx" ON "ArmyMovement"("villageId");
CREATE INDEX IF NOT EXISTS "ArmyMovement_battleId_idx" ON "ArmyMovement"("battleId");
CREATE INDEX IF NOT EXISTS "ArmyMovement_arrivalTime_idx" ON "ArmyMovement"("arrivalTime");
