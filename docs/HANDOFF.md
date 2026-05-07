# Neon Requiem - Project Handoff

**Date:** 2026-05-06
**Session focus:** Architectural deepening and engine refactoring (Heartbeat & Presence).

---

## 1. Current Verified State

- Git branch: `main`.
- Node version: `v22.x` required.
- Backend builds and tests pass:
  ```powershell
  npm run build
  npm test -- --silent
  ```
- **New Core Engine Components:**
  - `Heartbeat`: A subscriber-based timing system replacing the procedural game loop.
  - `PresenceService`: A character-centric presence and movement orchestrator.

---

## 2. Current Architecture Snapshot

### Backend Deepening (New)
The project has moved from a shallow procedural model to a **Deep Module** architecture for core engine systems:

- **Heartbeat (`src/engine/heartbeat.ts`):** 
  - Central "pulse" of the engine.
  - Modules implement the `Tickable` interface to register interest in time.
  - Supports variable frequencies (e.g., Combat every 1s, Security Patrol every 60s).
  - Isolated error handling: one subscriber failing does not stop the clock.

- **Presence & Movement (`src/engine/presence.service.ts`):**
  - Centralized "Who is where" state.
  - `WorldService` now updates presence automatically during `moveCharacter` and `navigate`.
  - Emits events (`character_joined`, `character_moved`, `character_left`) that `SocketHub` listens to.
  - **Leverage:** Decoupled socket management from movement logic.

### Domain Pattern
- `src/domains/<name>/`: Routes, Services, Repositories, and Types.
- `src/engine/`: Core game systems (Heartbeat, Presence, SocketHub, AuditLogger).
- `src/shared/`: Constants, types, and utility functions.

---

## 3. Completed Architecture Refactors

1. **Heartbeat Migration:**
   - Moved Combat tick processing into `CombatService` (now a `Tickable`).
   - Moved Security Patrol logic into a dedicated `SecurityPatrol` subscriber.
   - Deleted obsolete `game-loop.ts`.

2. **Presence Migration:**
   - Extracted presence logic from `SocketHub` into `PresenceService`.
   - Wired `WorldService` directly to `PresenceService` to eliminate DB/Memory desync.
   - `SocketHub` now acts as a pure **Adapter** that translates presence events into Socket.IO broadcasts.

3. **Command Dispatcher Extraction:**
   - Extracted command parsing and execution logic from `server.ts` into `src/engine/command-dispatcher.ts`.
   - Created `CommandOutput` interface for abstracting socket responses, enabling unit testing.
   - Moved POI fetching logic into `WorldService` and `WorldRepository`.

4. **ECS Foundation Implementation (Phase 2.0):**
   - Implemented a custom, lightweight Entity Component System (`src/engine/ecs/`).
   - `EcsRegistry` provides O(1) component access and optimized intersection queries.
   - `RegenSystem` integrated as a `Tickable` subscriber to the Heartbeat.
   - `MobFactory` enables instantiation of DB-driven Mob templates into active ECS entities.

---

## 4. Immediate Next Steps (Phase 2.1)

**Combat Migration to ECS**
Now that the foundation is ready, we need to migrate the existing `CombatService` logic to use ECS entities.
- **Goal:** Replace procedural Mob management in `CombatService` with ECS queries.
- **Benefit:** Allows for massive battles with hundreds of entities without degrading performance.
- **Task:** Update `CombatService` to use `EcsRegistry` and migrate Mob health/stat lookups to ECS components.

---

## 5. Scaling Research (`docs/RESEARCH_SCALE.md`)
We have identified the path forward for high-scale performance:
1. **Zonal Architecture:** Distributing world areas across processes.
2. **Global State:** Moving Presence/Combat into Redis for horizontal scaling.
3. **Precision Timing:** Researching `setImmediate` + `hrtime` for microsecond accuracy.
4. **ECS:** Adopting an Entity Component System for high-density NPC/Item processing.

---

## 6. CLI Best Practices (`docs/CLI-MEMORY.md`)
- **PowerShell Syntax:** Use `;` for multi-command lines (e.g., `Remove-Item a; Remove-Item b`).
- **Deepening Principles:** Prioritize **Locality** and **Leverage** in all refactors.
- **Deletion Test:** If complexity disappears when a module is deleted, it was a pass-through. If it reappears in callers, the module was earning its keep.

---

## 7. Local Run Notes
Backend: `npm start`
Frontend: `cd client; npm run dev`
Verification: `npm test`
