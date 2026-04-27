# Neon Requiem — Plan 03: World Engine Design
**Date:** 2026-04-19
**Status:** Approved
**Scope:** Zones, rooms, navigation, security ratings, Socket.IO movement events, static seed world

---

## 1. Goals

Build the navigable world foundation: a PostgreSQL-backed room/zone system with Socket.IO-driven movement, standard MUD arrival/departure broadcasts, and a minimal seed world (2 cities, ~20 rooms) sufficient for functional testing of all world engine behavior.

Not in scope for Plan 03: automap/exploration tracking, admin room-editing routes, player residences, NPC spawns, combat integration, Matrix nodes.

---

## 2. Data Model

Four Prisma model changes — two new domain models, one join model, and additions to `Character`.

### Zone
```prisma
model Zone {
  id              String         @id @default(cuid())
  slug            String         @unique
  name            String
  description     String
  securityRating  SecurityRating
  factionAffinity FactionAffinity
  rooms           Room[]
  createdAt       DateTime       @default(now())

  @@map("zones")
}
```

### Room
```prisma
model Room {
  id               String         @id @default(cuid())
  slug             String         @unique
  zoneId           String
  zone             Zone           @relation(fields: [zoneId], references: [id])
  name             String
  description      String
  securityRating   SecurityRating
  safeRoomFaction  FactionAffinity?
  exitsFrom        RoomExit[]     @relation("ExitFrom")
  exitsTo          RoomExit[]     @relation("ExitTo")
  currentOccupants Character[]    @relation("CurrentRoom")
  spawnOccupants   Character[]    @relation("SavedSpawn")
  createdAt        DateTime       @default(now())

  @@map("rooms")
}
```

### RoomExit
```prisma
model RoomExit {
  id           String    @id @default(cuid())
  fromRoomId   String
  fromRoom     Room      @relation("ExitFrom", fields: [fromRoomId], references: [id])
  toRoomId     String
  toRoom       Room      @relation("ExitTo", fields: [toRoomId], references: [id])
  direction    Direction
  isLocked     Boolean   @default(false)

  @@unique([fromRoomId, direction])
  @@map("room_exits")
}
```

### Character additions
```prisma
// Add to existing Character model:
currentRoomId    String?
currentRoom      Room?    @relation("CurrentRoom", fields: [currentRoomId], references: [id])
savedSpawnRoomId String?
savedSpawnRoom   Room?    @relation("SavedSpawn", fields: [savedSpawnRoomId], references: [id])
```

### Enums
```prisma
enum SecurityRating {
  AAA
  AA
  A
  B
  C
  D
  Z
  MISSION
}

enum FactionAffinity {
  shadow
  corp
  neutral
}

enum Direction {
  n
  s
  e
  w
  up
  down
}
```

### PvP derivation
PvP eligibility is **not stored** — derived at runtime:
```typescript
export function isPvpZone(rating: SecurityRating): boolean {
  return rating === 'D' || rating === 'Z' || rating === 'MISSION';
}
```

---

## 3. Domain Structure

```
src/domains/world/
├── world.types.ts       # Direction, RoomWithExits, MoveResult, OccupantInfo types
├── world.repository.ts  # getRoomWithExits(), updateCharacterRoom(), getRoomOccupants(), getSpawnRoom()
├── world.service.ts     # moveCharacter(), getRoomDescription(), resolveSpawnRoom()
├── world.events.ts      # registers 'world:move' handler on each SocketHub connection
└── world.seed.ts        # static seed data — 2 cities loaded on first run if DB is empty

tests/world/
└── world.service.test.ts
```

---

## 4. Socket.IO Event Contract

All world interaction is Socket.IO only. No REST movement endpoints.

| Direction | Emitter | Event | Payload |
|-----------|---------|-------|---------|
| Client → Server | Player socket | `world:move` | `{ direction: 'n'\|'s'\|'e'\|'w'\|'up'\|'down' }` |
| Server → Mover | SocketHub | `world:room` | `{ room: RoomWithExits, occupants: OccupantInfo[] }` |
| Server → Old room occupants | SocketHub | `world:departure` | `{ username: string, direction: Direction }` |
| Server → New room occupants | SocketHub | `world:arrival` | `{ username: string, fromDirection: Direction }` |
| Server → Mover (error) | SocketHub | `world:error` | `{ message: string }` |

### Movement validation order
1. Character has a `currentRoomId`
2. Exit exists in the requested direction from current room
3. Exit `isLocked` is false
4. DB update: set `currentRoomId` to target room
5. Broadcast departure to old room, arrival to new room, room description to mover

### `fromDirection` mapping
Opposite of the direction taken — so players in the new room see where the arrival came from:
```
n → s, s → n, e → w, w → e, up → down, down → up
```

---

## 5. Seed World

Loaded once on server start if the `zones` table is empty. Defined in `world.seed.ts` as TypeScript objects — version-controlled, no external files.

### Shadow City — Redline Sprawl (shadow-aligned)

| Room | Slug | Security | Notes |
|------|------|----------|-------|
| Gang Hall | `gang-hall` | C | Shadow safe room / default spawn |
| Back Alley | `back-alley` | C | |
| Redline Market | `redline-market` | C | |
| Industrial Block | `industrial-block` | D | PvP active |
| Scrapyard | `scrapyard` | D | |
| The Pit | `the-pit` | D | |
| Sewer Entrance | `sewer-entrance` | D | exit: down → Sewer Tunnels |
| Sewer Tunnels | `sewer-tunnels` | Z | |
| Condemned Block | `condemned-block` | Z | |
| Wasteland Gate | `wasteland-gate-west` | D | exit: east → Wasteland Outpost |

### Corp City — Axiom Arcology (corp-aligned)

| Room | Slug | Security | Notes |
|------|------|----------|-------|
| Division HQ | `division-hq` | AAA | Corp safe room / default spawn |
| Executive Floor | `executive-floor` | AA | exit: up from Corporate Plaza |
| Corporate Plaza | `corporate-plaza` | AA | |
| Transit Hub | `transit-hub` | A | |
| Residential Block | `residential-block` | B | |
| Commercial District | `commercial-district` | B | |
| Maintenance Level | `maintenance-level` | C | |
| Service Tunnels | `service-tunnels` | D | PvP active |
| Arcology Gate | `arcology-gate-east` | D | exit: west → Wasteland Outpost |
| Wasteland Outpost | `wasteland-outpost` | D | midpoint; connects both cities |

---

## 6. Spawn Room Resolution

On connect, `resolveSpawnRoom()` determines where the character loads:
1. Use `currentRoomId` if set and room exists and is not a MISSION room
2. Else use `savedSpawnRoomId` if set and room exists
3. Else use faction default safe room (`gang-hall` for shadow, `division-hq` for corp)

---

## 7. Testing

`world.service.test.ts` uses mocked repository — no DB required.

Key test cases:
- `moveCharacter` succeeds when exit exists and is unlocked
- `moveCharacter` returns error when no exit in direction
- `moveCharacter` returns error when exit is locked
- `resolveSpawnRoom` falls back correctly through all three tiers
- `isPvpZone` returns correct values for all SecurityRating values
- Departure/arrival payloads use correct `fromDirection` mapping

---

## 8. What's Next

**Plan 04: Combat System** — physical PvP/PvE engine, turn order, action pool, damage formulas. Requires world engine (room security ratings gate PvP).
