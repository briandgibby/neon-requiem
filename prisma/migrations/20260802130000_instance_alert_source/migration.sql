-- Preserve the room that most recently raised an instance-wide alert so patrols
-- have a concrete response destination after the originating ECS session ends.
ALTER TABLE "mission_instances"
ADD COLUMN "alertSourceRoomId" TEXT;
