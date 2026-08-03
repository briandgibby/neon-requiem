CREATE TABLE "patrol_definitions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "mobTemplateId" TEXT NOT NULL,
    "startRoomId" TEXT NOT NULL,
    "routeRoomSlugs" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patrol_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "patrol_definitions_slug_key" ON "patrol_definitions"("slug");
CREATE INDEX "patrol_definitions_enabled_idx" ON "patrol_definitions"("enabled");

ALTER TABLE "patrol_definitions"
ADD CONSTRAINT "patrol_definitions_mobTemplateId_fkey"
FOREIGN KEY ("mobTemplateId") REFERENCES "mob_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "patrol_definitions"
ADD CONSTRAINT "patrol_definitions_startRoomId_fkey"
FOREIGN KEY ("startRoomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
