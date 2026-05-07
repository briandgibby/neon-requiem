# HERMES.md

Project context for Hermes Agent in the Neon Requiem repository.

Neon Requiem is a TypeScript/Node cyberpunk-fantasy MUD prototype with a Fastify REST API, Socket.IO realtime gameplay, Prisma/PostgreSQL persistence, and a React/Vite/xterm.js client. Treat this file as the highest-priority repo-specific guidance for future agent work.

## Current Project Shape

- Backend entrypoint: `src/server.ts`.
- Backend architecture: modular monolith with domain services and repositories under `src/domains/*`.
- Realtime layer: `src/engine/socket-hub.ts` plus command handling currently wired in `src/server.ts`.
- Game loop: `src/engine/game-loop.ts` ticks timed combat/security behavior.
- Persistence: Prisma schema at `prisma/schema.prisma`; local database is PostgreSQL.
- Frontend: React + Vite client under `client/`, with xterm.js terminal gameplay in `client/src/components/Terminal.tsx` and main HUD in `client/src/views/GameView.tsx`.
- Operative docs:
  - `docs/HANDOFF.md`
  - `docs/CODING_STANDARDS.md`
  - `docs/UI_GUIDE.md`
  - `docs/superpowers/specs/*.md`
  - `docs/superpowers/plans/*.md`

## Verified Baseline As Of 2026-04-28

From WSL in `/mnt/c/users/brian/git/neon-requiem`:

- Branch: `main`.
- Backend Node observed in WSL: `v20.20.2`.
- Root `package.json` requires Node `>=22.0.0`; use Node 22 for intended verification.
- Backend build passes:
  - `npm run build`
- Backend tests pass:
  - `npm test -- --silent`
  - 9 test suites, 50 tests.
- Frontend build in WSL currently fails during Vite/Rolldown native binding load:
  - missing `@rolldown/binding-linux-x64-gnu`
  - likely install/environment related rather than proven source failure.
- Existing git worktree has many pre-existing modified files. Do not assume they are agent-authored unless created in the current task.

## Core Engineering Rules

### 1. Preserve Domain Boundaries

Keep the current layering unless intentionally changing architecture:

- `*.routes.ts`: HTTP request parsing, auth extraction, Zod validation, response mapping.
- `*.service.ts`: game/business rules.
- `*.repository.ts`: Prisma/database access only.
- `*.types.ts`: domain data shapes and result types.
- `src/shared/*`: cross-domain constants, primitive shared types, and app-wide errors/utilities.

Do not put database calls in routes. Do not put Fastify/Socket.IO objects in repositories. Keep side effects explicit.

### 2. Ownership And Location Checks Are Mandatory

Any action involving a player character must verify account ownership before mutation. Prefer repository methods such as `findByIdAndAccount` or equivalent service-level checks.

Before exposing or modifying gameplay actions, verify relevant spatial constraints:

- Movement: character owns the ID and is in the expected current room.
- Combat join/action: character owns the ID; joining a room should require `character.currentRoomId === roomId`.
- Matrix jack-in/hack: character owns the ID; physical room/node access must be valid.
- Shop purchase: character owns the ID and is physically at the shop room.
- Medical/magic/social actions: actor and target permissions must be explicit before exposing routes/commands.

Add or update IDOR/security tests when touching these paths.

### 3. Socket.IO Is Gameplay, Not Just Transport

The current realtime layer is incomplete. When building multiplayer features:

- Track selected character per socket.
- Track room membership.
- Join/leave Socket.IO rooms when characters move.
- Broadcast room-local events only to the appropriate room.
- Emit private events only to the owning socket/account.
- Treat reconnects and duplicate account sessions deliberately.

Do not broadcast private character state globally.

### 4. Command Handling Should Be Testable

Current command parsing lives in `src/server.ts` and is intentionally due for extraction. New command work should move toward a testable command router/service instead of growing inline socket callbacks.

A command handler should have explicit inputs and outputs:

- account ID
- selected character ID
- raw command text
- resulting private messages
- room updates
- room broadcasts
- character updates
- validation errors

Prefer pure parsing helpers with focused tests.

### 5. Keep TypeScript Strict And Explicit

- Preserve strict TypeScript settings.
- Avoid adding new `any` unless isolating third-party or JSON data; narrow it as close to the boundary as practical.
- Prefer explicit return types on services, repositories, command handlers, and exported functions.
- Keep route schemas in sync with service types.
- Do not add broad abstraction for one-off game logic.

### 6. Prisma JSON Fields Need Extra Care

Several systems persist complex JSON state, especially combat participants/session state. When changing JSON-backed structures:

- Validate shape at service boundaries.
- Keep migration/default behavior in mind.
- Consider concurrent read-modify-write hazards.
- Add regression tests for state transitions.
- Do not assume JSON writes are safe for live multiplayer without reviewing concurrency.

### 7. Frontend Rules

- Preserve the cyberpunk terminal/deck aesthetic in `docs/UI_GUIDE.md`.
- Avoid hardcoded backend URLs in new code; move toward `VITE_API_URL` and `VITE_SOCKET_URL`.
- Prefer typed API/socket payloads over `any`.
- Terminal UX should stay keyboard-first and readable.
- The client should surface connection/auth errors clearly.
- Do not introduce a new UI framework unless explicitly requested.

### 8. Testing And Verification

For backend changes, run the narrowest relevant tests first, then the broader checks:

```bash
npm run build
npm test -- --silent
```

For frontend changes, use Node 22 and run:

```bash
cd client
npm run build
```

If frontend build fails because of optional native dependency installation, report the exact error and do not mislabel it as a source-code failure without evidence.

Add tests for:

- ownership/IDOR cases
- command parser behavior
- movement/presence transitions
- combat lifecycle changes
- matrix state transitions
- shop transaction invariants

## Current Priority Order

### Phase 0 — Source Of Truth Cleanup

Keep this repo's operational docs accurate before expanding features:

1. Maintain this `HERMES.md` as Neon Requiem-specific guidance.
2. Keep `docs/HANDOFF.md` synchronized with verified build/test/client state.
3. Mark stale implementation plans as partial/stale when code has diverged.
4. Do not trust old plan checkboxes until code and tests confirm them.

### Phase 1 — Real Multiplayer Presence MVP

Implement the missing MUD substrate before expanding deeper systems:

1. Selected-character tracking in SocketHub.
2. Socket.IO room membership by current room.
3. Room occupants list.
4. Enter/leave broadcasts.
5. Local chat and basic commands:
   - `look`
   - `who`
   - `say`
   - `tell`
   - `help`
6. Frontend occupant/chat display.

Exit criteria: two browser sessions can select characters, meet in the same room, see each other, and use local chat.

### Phase 2 — Command Router Extraction

Move command parsing/dispatch out of `src/server.ts` into a testable command router/service. Keep server wiring thin.

### Phase 3 — Route/Service Alignment And Security

Expose only what is ownership-checked and tested. Align schemas, route actions, service moves, and frontend commands.

### Later Phases

After multiplayer presence and command routing are stable:

- Combat lifecycle and live room broadcasts.
- Matrix MVP completion and ICE ticking.
- Shop/economy transaction hardening.
- Medical, magic, and social commands/routes.
- Frontend configuration, typing, and error handling.
- CI/verification script consolidation.

## Known Gaps To Treat As Active Work

- `src/server.ts` still contains too much gameplay command logic.
- SocketHub does not yet manage room presence/occupants.
- Services exist for magic/medical/social, but route/command exposure is incomplete or absent.
- Combat route schema does not cover every move present in `CombatService`.
- Combat sessions use JSON read-modify-write state and need concurrency/lifecycle hardening.
- Frontend uses hardcoded local backend URLs in current code.
- Frontend has many `any` payloads and no visible automated client tests.
- Some docs/plans are stale relative to implementation.

## Change Discipline

- Make small, reviewable diffs.
- Do not reformat unrelated files.
- Do not overwrite existing user changes without checking git status first.
- If a file is already modified, assume it may contain user work and make the smallest targeted edit.
- Never expose secrets from `.env` or local databases; summarize sensitive values as `[REDACTED]`.
- Prefer measured verification over claims.

## Useful Commands

```bash
# repo status
git status --short

# backend verification
npm run build
npm test -- --silent

# frontend verification, intended with Node 22
cd client
npm run build

# inspect changed docs only
git diff -- HERMES.md docs/HANDOFF.md docs/superpowers/plans/2026-04-24-plan-04-combat-system.md docs/superpowers/plans/2026-04-24-plan-05-matrix-system.md docs/superpowers/plans/2026-04-24-plan-10-frontend.md
```
