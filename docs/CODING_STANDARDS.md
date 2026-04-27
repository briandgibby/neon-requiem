---
name: neon-requiem-patterns
description: Coding patterns, architecture conventions, and game design rules for the Neon Requiem MUD project
version: 1.0.0
source: local-git-analysis + design-spec
analyzed_commits: 1
---

# Neon Requiem Patterns

## Project Identity

Neon Requiem is a cyberpunk-fantasy hybrid graphical/text MUD (spiritual successor to Realms of Kaos).
Stack: Node.js 22 LTS + Socket.IO + Fastify + PostgreSQL 16 + Prisma + React + xterm.js.
All dependencies must be open source.

## Architecture: Modular Monolith

The project uses a **modular monolith** pattern. This is a deliberate choice — not a microservices
architecture, not a pure monolith. The rules:

- Each domain lives under `src/domains/<name>/`
- Domains communicate ONLY through exported service interfaces — never via direct cross-domain DB queries
- Each domain owns its own Prisma schema slice
- The `engine/` module owns the game loop and WebSocket hub
- `shared/` contains only types, constants, utilities, and errors — no business logic

```
src/
├── domains/
│   ├── auth/
│   ├── character/
│   ├── world/
│   ├── combat/
│   ├── matrix/
│   ├── magic/
│   ├── economy/
│   ├── loot/
│   ├── social/
│   └── events/
├── engine/
└── shared/
```

## Commit Conventions

This project uses conventional commits:
- `feat:` - New feature or game system
- `fix:` - Bug fix
- `chore:` - Maintenance, dependency updates
- `docs:` - Documentation only
- `test:` - Tests only
- `refactor:` - Code restructuring without behavior change
- `balance:` - Game balance tuning (damage values, drop rates, stat caps)
- `world:` - Room/zone/NPC content additions

## Domain Conventions

### File Structure Per Domain
```
src/domains/<name>/
├── <name>.service.ts      # Business logic — the only file other domains may import
├── <name>.repository.ts   # DB queries via Prisma — never imported outside domain
├── <name>.types.ts        # Domain-specific types
├── <name>.routes.ts       # Fastify route handlers (if REST-exposed)
└── <name>.test.ts         # Tests
```

### Domain Rules
- Never import from another domain's `.repository.ts` — only from `.service.ts`
- Never write raw SQL — use Prisma
- All public service methods must have TypeScript return types
- Input validation at service boundaries using Zod

## Game Design Constants (Source of Truth)

These values are locked in the design spec. Do not change without updating the spec:

| Constant | Value |
|----------|-------|
| Max level | 25 (TBC) |
| Class tier 1 cap | Level 8 |
| Class tier 2 unlock | Level 15 |
| Class tier 3 unlock | Level 25 |
| PvP protection ends | Level 8 |
| Base races | 6 |
| Subraces | 6 |
| Total races | 12 |
| Base classes | 16 |
| Mentor spirits | 8 |
| Factions | 2 (Corp / Shadow) |
| Game tick rate | ~1/second |

## Security Zone Rules

Always check zone security rating before applying PvP logic:
- AAA, AA, A, B, C → PvP disabled
- D, Z (no-sec) → PvP enabled
- Mission (instanced) → PvP always enabled regardless of zone

## Loot Rarity Tiers

In order: `common` → `uncommon` → `rare` → `legendary` → `unique`

When writing loot drop logic, always use these enum values — never raw strings.

## Faction / Social Terminology

| Shadow Faction | Corp Faction |
|---------------|-------------|
| Street Scum (base class) | Wage Slave (base class) |
| Gang | Division |
| Gang hall | Division office |
| Gang bank | Division fund |
| Gang chat | Division comms |

## Matrix System Rules

- Decker and Technomancer abilities are **utility-only** in open world zones
- Cybercombat (biofeedback damage) is restricted to designated PvP rooms and class-specific missions
- Decker power is gear-gated (cyberdeck quality); Technomancer is drain-limited
- Both classes deal equivalent regular combat damage to each other

## Testing Approach

Tests are written **after** working features are built — not before.

- Unit tests: per domain service (combat calc, loot rolls, matrix resolution, stat gen)
- Integration tests: critical paths (character creation, death/respawn, soulbinding, WebSocket sessions)
- Load tests: concurrent player simulation via Artillery or k6
- No mocking of the database in integration tests

## Performance Rules

RoK's lag was caused by flat .dat file storage. Never repeat this:
- All persistent state lives in PostgreSQL — no flat files for game state
- Active session state cached in memory; persisted to DB on tick or event
- No polling from client — all real-time updates via WebSocket push
- pgBouncer handles connection pooling

## Naming Conventions

- Files: `kebab-case.ts`
- Classes/Types/Interfaces: `PascalCase`
- Functions/variables: `camelCase`
- Database tables: `snake_case`
- Constants: `SCREAMING_SNAKE_CASE`
- Game content identifiers (item slugs, room IDs): `kebab-case`

## Documentation Location

- Design spec: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- Implementation plans: `docs/superpowers/plans/`
- API docs: `docs/api/`
- World-building / lore: `docs/lore/`
