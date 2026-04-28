# Neon Requiem - Project Handoff
**Date:** 2026-04-27  
**Session focus:** Alpha viability stabilization, runtime fixes, auth ownership, and UI character creation.

---

## 1. Current Verified State

- Backend builds successfully from the repo root with `npm run build`.
- Backend test suite passes: 9 suites, 50 tests.
- Frontend builds successfully on the user's machine after installing the required Windows C++ runtime dependencies.
- Account registration works through the game client.
- Character creation now works through the game client.
- The game client successfully connects to the backend Socket.IO server.

The project is now usable as a local prototype baseline for account creation, character creation, and entering the connected game client.

---

## 2. Work Completed This Session

### Codex Instructions
- Added root-level `AGENTS.md`, converted from `GEMINI.md`, so Codex has repo-specific project instructions.

### Backend Build Stabilization
- Fixed backend compile blockers.
- Corrected service construction order in `src/server.ts`.
- Added missing `MobRepository`, `MagicRepository`, and `MagicService` wiring.
- Fixed combat participant type drift in code and tests.
- Fixed Prisma typing issues in combat/world repositories.
- Fixed shop route auth access.

### Runtime Architecture
- Fixed Socket.IO binding.
  - Socket.IO now attaches to Fastify's actual `app.server`.
  - Removed the unused separate HTTP server that prevented reliable socket connectivity.
- Added startup validation for:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `PORT`
- Added graceful shutdown for:
  - game loop
  - Socket.IO
  - Fastify
  - Prisma
  - Postgres pool

### Auth And Ownership
- Added shared auth helper in `src/domains/auth/auth.middleware.ts`.
- Added Fastify request typing for `request.user`.
- Replaced duplicated route-level token parsing in character, world, combat, matrix, and mission routes.
- Enforced character ownership for:
  - combat join/action
  - matrix jack-in/jack-out/hack
  - mission accept/complete
- Added IDOR regression tests for the newly protected paths.

### Character Creation UI
- Fixed the Finalize button behavior in the character creator.
- The client now submits only backend-valid fields:
  - `streetDocPath` only for `street-doc`
  - `mentorSpirit` only for awakened classes
- Added a local validation guard for too-short names.
- Backend character creation now returns clean `422` validation responses for malformed payloads.

---

## 3. Important Caveats

- The current multiplayer experience is still mostly single-player with sockets.
- Room presence is not implemented yet.
- Players do not currently see other players entering/leaving a room.
- Local chat commands such as `say`, `tell`, `who`, and `look` are not implemented yet.
- Combat state still uses JSON read-modify-write persistence and is not safe enough for concurrent live play.
- PM2 is still configured for a single backend instance, which is fine for local/small alpha testing.
- There is an untracked Prisma migration folder from local testing: `prisma/migrations/20260427144918_test1/`. Review before committing.

---

## 4. Local Run Notes

Backend:

```powershell
cd C:\Users\brian\git\neon-requiem
npm run build
npm start
```

Frontend:

```powershell
cd C:\Users\brian\git\neon-requiem\client
npm run dev
```

Database reset option for local Postgres on port 5435:

```powershell
npx prisma migrate reset
```

Seed data:

```powershell
npx prisma db seed
```

Open the Vite URL, usually `http://localhost:5173/`, then register an account and create a character.

---

## 5. Recommended Next Phase

Next work should start with **Phase 3: Real Multiplayer Presence**.

Suggested scope:

1. Track selected characters in `SocketHub`.
2. Track room membership.
3. Join/leave Socket.IO rooms when characters move.
4. Broadcast local events:
   - player enters
   - player leaves
   - local chat
   - character selected
5. Add basic commands:
   - `look`
   - `who`
   - `say`
   - `tell`
   - `help`
6. Update the client to show room occupants and local chat output.

Exit criteria for this phase:

- Two players can log in from separate browser sessions.
- Both can select characters.
- Both can move to the same room.
- Each player can see the other in the room.
- `say` broadcasts only to occupants of the same room.

---

## 6. Verification Commands

Backend:

```powershell
cd C:\Users\brian\git\neon-requiem
npm run build
npm test
```

Frontend:

```powershell
cd C:\Users\brian\git\neon-requiem\client
npm run build
```

