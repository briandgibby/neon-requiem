-- Persist player-defined command triggers per character.
ALTER TABLE "characters"
ADD COLUMN "hotkeys" JSONB NOT NULL DEFAULT '{}';
