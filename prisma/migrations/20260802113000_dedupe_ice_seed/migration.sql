-- Keep one canonical ICE row for each authored identity before enforcing it.
WITH ranked_ice AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "nodeId", "slug"
            ORDER BY "id"
        ) AS duplicate_number
    FROM "ice"
)
DELETE FROM "ice"
USING ranked_ice
WHERE "ice"."id" = ranked_ice."id"
  AND ranked_ice.duplicate_number > 1;

-- An ICE slug identifies at most one active definition within a Matrix node.
CREATE UNIQUE INDEX "ice_nodeId_slug_key" ON "ice"("nodeId", "slug");
