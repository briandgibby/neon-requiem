-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "faction" TEXT NOT NULL,
    "race" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "streetDocPath" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experiencePoints" INTEGER NOT NULL DEFAULT 0,
    "body" INTEGER NOT NULL,
    "agility" INTEGER NOT NULL,
    "dexterity" INTEGER NOT NULL,
    "strength" INTEGER NOT NULL,
    "logic" INTEGER NOT NULL,
    "intuition" INTEGER NOT NULL,
    "willpower" INTEGER NOT NULL,
    "charisma" INTEGER NOT NULL,
    "biosync" INTEGER NOT NULL,
    "luck" INTEGER NOT NULL,
    "luckPool" INTEGER NOT NULL,
    "magic" INTEGER,
    "resonance" INTEGER,
    "mentorSpirit" TEXT,
    "currentRoomId" TEXT,
    "isCreationComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "securityRating" TEXT NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "securityRating" TEXT,
    "isMatrixNode" BOOLEAN NOT NULL DEFAULT false,
    "exits" JSONB,
    "npcSpawnTable" TEXT,
    "factionOwner" TEXT,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "characters_accountId_name_key" ON "characters"("accountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "zones_slug_key" ON "zones"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_slug_key" ON "rooms"("slug");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_currentRoomId_fkey" FOREIGN KEY ("currentRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
