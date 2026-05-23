-- AlterTable
ALTER TABLE "matrix_nodes" ADD COLUMN     "requiresPhysicalPresence" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "mob_templates" ADD COLUMN     "corporationId" TEXT,
ADD COLUMN     "eliteOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "isSafeZone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "missionInstanceId" TEXT,
ADD COLUMN     "safeZoneOverrideActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "mission_instances" (
    "id" TEXT NOT NULL,
    "activeMissionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "alertLevel" TEXT NOT NULL DEFAULT 'GREEN',
    "partyLeaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "lastPartyMemberDepartedAt" TIMESTAMP(3),

    CONSTRAINT "mission_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mission_instances_activeMissionId_key" ON "mission_instances"("activeMissionId");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_missionInstanceId_fkey" FOREIGN KEY ("missionInstanceId") REFERENCES "mission_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_instances" ADD CONSTRAINT "mission_instances_activeMissionId_fkey" FOREIGN KEY ("activeMissionId") REFERENCES "active_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
