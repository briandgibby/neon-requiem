# Neon Requiem - Project Handoff

**Date:** 2026-05-09
**Session focus:** Diagnosis pass over recent ECS lifecycle, Matrix, Mission, SocketHub, frontend Matrix changes, and Phase 4.2 setup.

---

## 1. Current Verified State

- Git branch: `main`.
- Node version: `v22.x` required.
- Backend builds and tests pass:
  ```powershell
  npm run build
  npm test -- --silent
  ```
- Verified backend result after diagnosis:
  - `npm run build`: passes.
  - `npm test -- --silent`: passes, 20 suites / 91 tests.
- Frontend verification:
  - `cd client; npm exec -- tsc -b`: passes.
  - `cd client; npm run build`: passes under Node `v22.22.2` after reinstalling frontend dependencies with optional native packages.
  - `cd client; npm run lint`: fails on existing lint debt, mostly explicit `any`, React hook rules, static components declared during render, and `useSocket` returning `socketRef.current`.
- Environment setup update:
  - Node `v22.22.2` is installed, but this Codex shell still resolves `node` through `fnm` to `v20.20.2` unless Node 22 is forced into `PATH`.
  - Verified command prefix in this session: `PATH=/home/bdgibby/.local/share/fnm/node-versions/v22.22.2/installation/bin:$PATH`.
  - Root dependencies were reinstalled and Prisma was regenerated successfully.
  - Prisma packages are aligned on `7.7.0`: `prisma`, `@prisma/client`, and `@prisma/adapter-pg`.
- **New Core Engine Components:**
  - `Heartbeat`: A subscriber-based timing system replacing the procedural game loop.
  - `PresenceService`: A character-centric presence and movement orchestrator.
  - `PlayerSyncCoordinator`: Transactional ECS-to-DB player snapshot persistence for disconnects and periodic syncs.

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

5. **Combat Migration to ECS (Phase 2.1):**
   - Refactored `CombatService` into an adapter between the server API and the ECS registry.
   - Decoupled move execution via `MoveDispatcher` and isolated `AttackExecutor`.
   - Extracted combat loop mechanics into `CombatTickSystem` and `CombatReinforcementSystem`.
   - Updated stats and states to rely entirely on granular ECS components instead of monolithic database JSON fields.

6. **Matrix Migration to ECS (Phase 3.0):**
   - Refactored `MatrixService` into an adapter between the server API and the ECS registry.
   - Introduced `MatrixNode`, `Ice`, and `Decker` ECS components.
   - Added Matrix actions (`brute`, `sleaze`, `data-spike`) to the `MoveDispatcher` architecture as `MoveExecutor`s, unifying the action economy.
   - Implemented `MatrixTickSystem` for alert decay and `IceAiSystem` for automated ICE countermeasures against intruding Deckers.

7. **Matrix Frontend and Command Integration (Phase 3.1):**
   - Added Matrix commands (`jack in`, `jack out`, `brute`, `sleaze`, `data spike`) to the `CommandDispatcher`.
   - Updated `client/src/components/Terminal.tsx` to handle matrix visual mode (color grading, prompt).
   - Updated `client/src/views/GameView.tsx` to consume `matrix_data` events and render the host details.

8. **Mission System Integration (Phase 3.2):**
   - Introduced `MissionTargetComponent` to track objectives directly on ECS entities (NPCs, Nodes).
   - Implemented `MissionSystem` to monitor objective completion (e.g., target neutralized, node breached) independently of player actions.
   - Refactored `MissionService` to receive objective updates from the ECS and persist progress to the database.
   - Updated `AuditLogger` and `MissionRepository` to support new objective tracking mechanics.

9. **ECS Lifecycle and Garbage Collection (Phase 4.0):**
   - Implemented `EntityCleanupSystem` to automatically reap dead NPCs, empty combat sessions, and abandoned Matrix nodes from memory.
   - Created `PlayerSyncCoordinator` to manage transactional character persistence.
   - **Redundancy:** Introduced a "Snapshot-First" disconnect flow. Character entities are only destroyed from memory *after* a successful database transaction is confirmed, preventing data loss and duplication glitches.
   - Integrated periodic state checkpointing (every 20 ticks) for all active players.
   - Updated UI to group identical entity names with counts (e.g., "Security Guard (3)") for better readability.

10. **Diagnosis Hardening Pass (2026-05-09):**
   - Fixed bootstrap wiring drift: `MatrixService` now receives the shared `EcsRegistry` and `MoveDispatcher`; `CombatService` receives `PlayerSyncCoordinator`; `SocketHub` receives the sync coordinator.
   - Replaced stale `SecurityPatrol` calls to removed DB-backed combat session APIs with `CombatService.triggerSecurityAlarm`, which mutates ECS combat sessions directly.
   - Fixed Matrix jack-in lifecycle:
     - Persists the real DB Matrix node id to `Character.activeNodeId`.
     - Returns a complete Matrix node view with identity and alert/security state.
     - Preserves the character's physical room `Position` so disconnect snapshots do not try to persist an ECS node id into `currentRoomId`.
   - Added ownership checks for ECS-backed Matrix actions so one account cannot drive another account's active Decker entity.
   - Tightened disconnect handling:
     - Final snapshot audit rows are written inside the same Prisma transaction as the character update.
     - Socket presence is removed even if snapshot persistence fails, while the ECS entity remains in memory for recovery.
   - Tightened mission completion:
     - `completeMission` now verifies the mission belongs to the requesting character.
     - Inactive missions cannot be completed again.
     - Successful completion marks the mission `COMPLETED`.
   - Added regression tests:
     - `tests/matrix/matrix.service.test.ts`
     - `tests/engine/player-sync-coordinator.test.ts`
     - `tests/mission/mission.service.test.ts`
   - Frontend cleanup: `GameView` now removes its `matrix_data` socket handler during effect cleanup.

11. **Phase 4.2 Start (2026-05-09):**
   - Matrix ICE now materializes into ECS when `MatrixService.getOrCreateEcsNode` loads a DB Matrix node.
   - Matrix node views now expose active ICE with stable DB ids plus ECS entity ids, health, identity, and type data.
   - `data spike <ice-id>` now accepts a DB ICE id from the node view and resolves it to the live ECS ICE entity in the decker's active node.
   - Accepted missions now attach `MissionTargetComponent` to spawned ECS NPC targets when generated `spawnData` resolves to a known room and mob template.
   - Added regression coverage for Matrix ICE spawning/data spike resolution and mission target attachment.

---

## 4. Immediate Next Steps (Phase 4.2)

**Mission and Matrix ECS Completion**
The diagnosis pass found the lifecycle foundation viable, but two gameplay loops are still only partially connected end to end.

- **Mission targets:** Accepted missions now attach generated NPC targets to live ECS entities when rooms/templates resolve. Remaining work: expand this beyond NPC assassination targets into Matrix-node objectives and other objective types.
- **Matrix ICE:** DB-backed Matrix ICE now spawns into ECS and `data spike` accepts stable DB ICE ids. Remaining work: persist ICE HP/alert changes back to the database when ECS state changes should survive cleanup/restart.
- **Snapshot history/admin tooling:** The transaction log is now safer, but there is still no admin-facing snapshot history view.
- **Frontend maintenance:** Client typecheck and production build now pass under Node 22. Remaining frontend maintenance is lint debt in `client/src`.
- **Line ending / diff hygiene:** The working tree has broad pre-existing churn across many files. Normalize review scope before a PR to avoid burying functional changes in whitespace noise.


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
Verification:
- Backend: `npm run build`; `npm test -- --silent`
- Frontend typecheck: `cd client; npm exec -- tsc -b`
- Frontend bundle: `cd client; npm run build` under Node 22 with dependencies installed for the current platform
- Current shell note: if `node -v` reports `v20.20.2`, prepend Node 22 explicitly:
  ```bash
  PATH=/home/bdgibby/.local/share/fnm/node-versions/v22.22.2/installation/bin:$PATH <command>
  ```
