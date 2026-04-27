# Neon Requiem — Plan 02: Character Domain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the character domain — races, classes, stat system, and character creation flow — providing the foundation for all gameplay systems.

**Status:** Complete — 24 tests passing (15 new), merged to master.

**Design decisions locked in this plan:**
- Job change mechanic: **B — title upgrade + power bonus at fixed levels** (class name changes, math improves, no branching). Tier 2/3 class names TBD.
- Karma pool size at creation: TBD — stat validation enforces racial floor/cap but skips karma budget
- Awakened classes (mage-hermetic, shaman, street-doc, weapons-adept) require `mentorSpirit`; get `magic = 0`
- Matrix classes (decker, technomancer) get `resonance = 0`
- street-doc requires `streetDocPath: 'magic' | 'tech'`
- Biosync starts at 7 (elf/dark-elf), 5 (dwarf), 6 (all others)
- `luckPool` starts equal to the assigned `luck` value at creation

---

## File Map

```
src/
├── shared/
│   ├── types.ts          (updated — Race, ClassName, MentorSpirit, ClassLine, StreetDocPath)
│   ├── constants.ts      (updated — MAX_LEVEL=50, AWAKENED_CLASSES, MATRIX_CLASSES)
│   ├── races.ts          (created — RaceData for all 12 races with floor/cap per stat)
│   └── classes.ts        (created — ClassData for all 16 classes with flags)
├── domains/
│   └── character/
│       ├── character.types.ts       (CreateCharacterInput, CharacterRecord)
│       ├── character.repository.ts  (Prisma queries)
│       ├── character.service.ts     (business logic + validation)
│       └── character.routes.ts      (POST/GET /characters)
tests/
└── character/
    └── character.service.test.ts    (15 tests)
prisma/
└── schema.prisma                    (Character model added)
```

---

## Task 1: Prisma Schema + Migration

- [x] Character model added with all stat fields, biosync, luck, luckPool, magic?, resonance?, mentorSpirit?
- [x] `@@unique([accountId, name])` — name unique per account
- [x] Cascading delete from Account → Character
- [ ] **Run migration** *(manual — requires live DB)*

```bash
npm run db:migrate -- --name add-character
npm run db:generate
```

---

## Task 2: Shared Types + Constants

- [x] `Race`, `ClassName`, `MentorSpirit`, `StreetDocPath`, `ClassLine` added to `src/shared/types.ts`
- [x] `MAX_LEVEL` updated 25 → 50
- [x] `AWAKENED_CLASSES` and `MATRIX_CLASSES` constants added

---

## Task 3: Racial Data (`src/shared/races.ts`)

- [x] All 12 races: human, surge, elf, dark-elf, dwarf, gnome, halfling, goblin, ork, oni, troll, minotaur
- [x] Each race has floor/cap for: body, agility, dexterity, strength, logic, intuition, willpower, charisma, luck
- [x] Each race has `biosync` starting value
- [x] Surge and Goblin tagged with `biosyncCyberwarePenalty: 0.1`

---

## Task 4: Class Data (`src/shared/classes.ts`)

- [x] All 16 classes across 4 lines (combat, shadow, matrix, awakened)
- [x] Flags: `isAwakened`, `isMatrix`, `requiresStreetDocPath`

---

## Task 5: Character Domain

- [x] `character.types.ts` — `CreateCharacterInput`, `CharacterRecord`
- [x] `character.repository.ts` — create, findById, findByAccountId, findByAccountAndName
- [x] `character.service.ts` — createCharacter (full validation), getCharacter, listCharacters
- [x] `character.routes.ts` — POST /characters, GET /characters, GET /characters/:id (Bearer token auth via AuthService)

**Validation in service:**
1. Valid race slug
2. Valid class slug
3. Each of 9 stats within racial floor/cap
4. `mentorSpirit` required iff awakened class
5. `streetDocPath` required iff street-doc
6. Name uniqueness per account (ConflictError)

---

## Task 6: Tests (15 tests)

- [x] Valid human street-samurai creation
- [x] biosync = 7 for elf
- [x] luckPool = luck at creation
- [x] magic = 0, resonance = null for awakened class
- [x] resonance = 0, magic = null for matrix class
- [x] ConflictError on duplicate name
- [x] ValidationError: unknown race
- [x] ValidationError: stat above racial cap
- [x] ValidationError: stat below racial floor
- [x] ValidationError: awakened class missing mentorSpirit
- [x] ValidationError: non-awakened class with mentorSpirit
- [x] ValidationError: street-doc missing streetDocPath
- [x] getCharacter: found
- [x] getCharacter: NotFoundError
- [x] listCharacters: returns array

---

## Completion Checklist

- [x] `npm test` — 24/24 passing
- [x] `npx tsc --noEmit` — no errors
- [ ] `npm run db:migrate` — pending (needs live DB)
- [ ] End-to-end: POST /characters → 201; duplicate → 409; bad stat → 422

---

## What's Next

**Plan 03: World + Zone Engine** — zone definitions, room system, security ratings, NPC spawn tables, day/night cycle.

**Remaining open questions to resolve before Plan 03:**
- Tier 2 and Tier 3 class names for all 16 class paths
- Fixed levels at which job changes occur (e.g., level 15 / level 30?)
- Karma pool size and per-stat costs (for character creation UI)
- World map layout, city names, zone names, corp/gang names
