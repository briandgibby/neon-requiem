# Neon Requiem — Plan 03: World Engine

**Goal:** Implement the world domain — zones, rooms, security ratings, and player movement — providing the spatial foundation for gameplay.

**Status:** Complete — 32/32 tests passing (8 new), world seeded.

---

## File Map

```
src/
├── shared/
│   ├── types.ts          (updated — SecurityRating, Direction)
│   └── constants.ts      (updated — STARTING_ROOM_SHADOW, STARTING_ROOM_CORP)
├── domains/
│   ├── character/
│   │   ├── character.types.ts   (updated — currentRoomId added)
│   │   └── character.service.ts (updated — initialize location on create)
│   └── world/
│       ├── world.types.ts       (RoomRecord, ZoneRecord, MovementResult)
│       ├── world.repository.ts  (Prisma queries for zones/rooms)
│       ├── world.service.ts     (Movement logic, world state)
│       └── world.routes.ts      (GET /rooms/:id, POST /move)
tests/
└── world/
    └── world.service.test.ts
prisma/
├── schema.prisma                    (Zone and Room models added; Character updated)
└── seed.ts                          (World seeding script)
```

---

## Task 1: Prisma Schema + Migration

- [x] Add `Zone` model: `id`, `slug` (unique), `name`, `securityRating`
- [x] Add `Room` model: `id`, `slug` (unique), `zoneId`, `name`, `description`, `securityRating` (optional override), `isMatrixNode`, `exits` (Json), `npcSpawnTable` (optional), `factionOwner` (optional)
- [x] Update `Character` model: add `currentRoomId` (optional, default to null or a starting room)
- [x] **Run migration**

---

## Task 2: Shared Types + Constants

- [x] `Direction` type: `'north' | 'south' | 'east' | 'west' | 'up' | 'down' | 'northeast' | 'northwest' | 'southeast' | 'southwest'`
- [x] `SecurityRating` is already in `types.ts`
- [x] Define `STARTING_ROOM_SHADOW` and `STARTING_ROOM_CORP` constants in `src/shared/constants.ts`

---

## Task 3: World Domain Implementation

- [x] `world.types.ts`: Define interfaces for Room and Zone records, and movement inputs/outputs.
- [x] `world.repository.ts`:
    - `findRoomBySlug(slug: string)`
    - `findRoomById(id: string)`
    - `findZoneBySlug(slug: string)`
    - `updateCharacterLocation(characterId: string, roomId: string)`
- [x] `world.service.ts`:
    - `getRoom(slugOrId: string)`
    - `moveCharacter(characterId: string, direction: Direction)`:
        - Get current room
        - Check if exit exists
        - Update character location in DB
        - Return new room data
- [x] `world.routes.ts`:
    - `GET /rooms/:slug` (Authenticated)
    - `POST /world/move` (Authenticated, body: `{ direction }`)

---

## Task 4: World Seeding / Bootstrap

- [x] Create a mechanism to load world data (Zones/Rooms) from a JSON file or script.
- [x] Define initial "Gleaming Arcology Hub" (Corp) and "Undermarket Sprawl" (Shadow) zones with at least 5 rooms each for testing.

---

## Task 5: Tests

- [x] `moveCharacter`: success
- [x] `moveCharacter`: no exit in that direction
- [x] `moveCharacter`: character not found
- [x] `getRoom`: success
- [x] `getRoom`: not found

---

## Task 6: Integration with Engine

- [ ] Update `SocketHub` or a new `WorldHub` to broadcast "player entered/left room" messages (deferred to Plan 04).
- [x] Ensure character location is initialized during character creation.

---

## Completion Checklist

- [x] `npm test` — all tests passing (32/32)
- [x] `npx tsc --noEmit` — no errors
- [x] World data successfully seeded
- [x] Player can move between rooms via API and location persists in DB
