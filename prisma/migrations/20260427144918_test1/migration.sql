/*
  Warnings:

  - Added the required column `currentHp` to the `ice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "activeAuraId" TEXT,
ADD COLUMN     "areaKnowledge" TEXT[],
ADD COLUMN     "biofeedbackBuffer" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentMana" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "currentStun" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "deathSicknessUntil" TIMESTAMP(3),
ADD COLUMN     "disguiseIdentity" TEXT,
ADD COLUMN     "hasValidSIN" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manaRegenBuff" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "manaRegenRate" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "maxInventorySlots" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "maxMana" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "maxStun" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "nuyen" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reputationCorp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reputationShadow" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ice" ADD COLUMN     "currentHp" INTEGER NOT NULL,
ADD COLUMN     "hardening" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "corruptionLevel" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "equipSlot" TEXT,
ADD COLUMN     "slots" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "matrix_nodes" ADD COLUMN     "alertLevel" TEXT NOT NULL DEFAULT 'GREEN';

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "baseDisposition" TEXT DEFAULT 'NEUTRAL',
ADD COLUMN     "gridX" INTEGER,
ADD COLUMN     "gridY" INTEGER,
ADD COLUMN     "isClean" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isPOI" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastCombatAt" TIMESTAMP(3),
ADD COLUMN     "poiCategory" TEXT;

-- CreateTable
CREATE TABLE "spells" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tradition" TEXT NOT NULL,
    "apCost" INTEGER NOT NULL DEFAULT 2,
    "manaCost" INTEGER NOT NULL,
    "cooldown" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,

    CONSTRAINT "spells_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adept_powers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "apCost" INTEGER NOT NULL DEFAULT 1,
    "manaCost" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "description" TEXT NOT NULL,

    CONSTRAINT "adept_powers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combat_sessions" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "securityRating" TEXT NOT NULL,
    "tick" INTEGER NOT NULL DEFAULT 0,
    "alarmState" TEXT NOT NULL DEFAULT 'GREEN',
    "turnsUntilReinforcements" INTEGER,
    "backupCalled" BOOLEAN NOT NULL DEFAULT false,
    "participants" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "combat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mob_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "body" INTEGER NOT NULL,
    "agility" INTEGER NOT NULL,
    "dexterity" INTEGER NOT NULL,
    "strength" INTEGER NOT NULL,
    "logic" INTEGER NOT NULL,
    "intuition" INTEGER NOT NULL,
    "willpower" INTEGER NOT NULL,
    "charisma" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "maxAp" INTEGER NOT NULL DEFAULT 6,
    "armorValue" INTEGER NOT NULL DEFAULT 0,
    "masteryCQC" INTEGER NOT NULL DEFAULT 0,
    "masteryPistol" INTEGER NOT NULL DEFAULT 0,
    "masteryRifle" INTEGER NOT NULL DEFAULT 0,
    "masteryAutomatic" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mob_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_items" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT -1,

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "characterId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_templates" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "baseDifficulty" INTEGER NOT NULL DEFAULT 1,
    "basePayout" INTEGER NOT NULL DEFAULT 1000,
    "requiredClasses" JSONB,

    CONSTRAINT "mission_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_missions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "partyId" TEXT,
    "leaderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "seed" TEXT NOT NULL,
    "currentObjective" INTEGER NOT NULL DEFAULT 0,
    "targetData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_missions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spells_slug_key" ON "spells"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "adept_powers_slug_key" ON "adept_powers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "combat_sessions_roomId_key" ON "combat_sessions"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "mob_templates_slug_key" ON "mob_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "shop_items_roomId_itemId_key" ON "shop_items"("roomId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "mission_templates_slug_key" ON "mission_templates"("slug");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_activeAuraId_fkey" FOREIGN KEY ("activeAuraId") REFERENCES "adept_powers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combat_sessions" ADD CONSTRAINT "combat_sessions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_missions" ADD CONSTRAINT "active_missions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "mission_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "active_missions" ADD CONSTRAINT "active_missions_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
