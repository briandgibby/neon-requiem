# Neon Requiem - Project Handoff

**Date:** 2026-05-16
**Session focus:** Phase 4.3 complete. Mission Instancing, Physical Body Persistence, and Alert Escalation all implemented and tested.

---

## 1. Current Verified State

- Git branch: `main`.
- Node version: `v22.x` required.
- Backend builds and tests pass:
  ```powershell
  npm run build
  npm test -- --silent
  ```
- Verified backend result (2026-05-13):
  - `npm run build`: passes.
  - `npm test -- --silent`: passes, **22 suites / 112 tests** (all Phase 4.2 work included).
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
- Verified backend result (2026-05-16):
  - `npm run build`: passes.
  - `npm test -- --silent`: passes, **24 suites / 133 tests** (all Phase 4.3 + CommandRegistry refactor included).
- Git branch at session end: `feat/phase-4.3` (16 commits ahead of main; not yet merged).

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

11. **Phase 4.2 — Matrix/Mission ECS Completion (COMPLETE, 2026-05-12, merged to main):**
   - Matrix ICE materializes into ECS when `MatrixService.getOrCreateEcsNode` loads a DB Matrix node.
   - `data spike <ice-id>` resolves DB ICE ids to live ECS entities; ICE HP flushed to DB after every spike.
   - `performHacking` flushes alert level to DB, increments `breachProgress` on the node, and accumulates `overwatchScore` on the decker.
   - `MatrixTickSystem` injects `MatrixRepository` and flushes alert decay to DB.
   - `MissionGenerator` produces `nodeTargetData` for MATRIX-type missions.
   - `MissionRepository.findActiveMissionsByNodeRoom` added for node→mission lookup.
   - `MissionService.acceptMission` resolves node target room slugs to DB room IDs.
   - `MatrixService` accepts an `onNodeCreated` callback; server wires it to attach `MissionTargetComponent` to newly created ECS node entities.
   - `MissionSystem` HACK detection replaced: uses `breachProgress >= hackThreshold` instead of `alertLevel === RED`.
   - All 9 tasks committed; 22 suites / 112 tests green.
   - **Pending commit:** `tests/mission/mission.service.test.ts` has an uncommitted `MissionRepository.findActiveMissionsByNodeRoom` test block — commit this before starting Phase 4.3.

13. **CommandRegistry Architecture Refactor (2026-05-16):**
   - Branch: `feat/phase-4.3`
   - Replaced the monolithic `CommandDispatcher` if/else chain with a `CommandRegistry` + `CommandHandler` seam.
   - `CommandDispatcher` is now a thin 5-step router: parse → look up → resolve client → mode guard → execute (110 lines, down from 235).
   - Each command is its own class in `src/engine/commands/` with constructor-injected deps, `aliases`, `mode`, `label`, `description`, and `usage` metadata.
   - **Four execution modes enforced by the dispatcher:** `physical` (blocked if jacked in), `matrix` (blocked if not jacked in), `wireless` (blocked if jacked in or wrong class), `any` (unrestricted).
   - `CharacterClassComponent` added to ECS and cached at entity creation in both `CombatService.joinCombat` and `MatrixService.jackIn` — zero DB overhead at dispatch time.
   - Wireless class whitelist: `decker`, `technomancer`, `rigger`.
   - Multi-word normalization (`"jack in"` → `'jackin'`) handled by a static map in `parseCommand`; registry stays a plain `Map`.
   - `CommandRegistry.getAll()` exposes handler metadata for the hotkey picker UI (accessibility path: players can configure all commands via dropdowns, no typing required).
   - Social handlers (`SayHandler`, `TellHandler`) inject `SocketHub` directly; all other handlers are socket-agnostic.
   - `HelpHandler` renders dynamically from the registry; new commands appear in `help` output automatically.
   - `CONTEXT.md` created at `docs/CONTEXT.md` with canonical domain vocabulary: Rigger, Vehicle, Compulsory Follow, Wireless Mode, Hotkey, Hotkey Picker, and Mission concepts.
   - Tests updated; 24 suites / 133 tests green.

12. **Phase 4.3 — Mission Instancing, Physical Body Persistence & Alert Escalation (COMPLETE, 2026-05-16):**
   - Branch: `feat/phase-4.3` (15 commits; not yet merged to main)
   - Spec: `docs/superpowers/specs/2026-05-13-phase-4.3-instancing-body-persistence-design.md`
   - Plan: `docs/superpowers/plans/2026-05-13-phase-4.3-implementation.md`
   - All 12 tasks delivered; 24 suites / 132 tests green.
   - **What shipped:**
     - `MissionInstance` DB model; `InstanceRepository` with one-way alert escalation and `rooms: { some: {} }` cleanup guard
     - `DeckerComponent.physicalRoomId` set at `jackIn`, restored at `jackOut`
     - `requiresPhysicalPresence: true` on instance `MatrixNode`; `jackIn` enforces physical co-location
     - Movement blocked in `CommandDispatcher` when entity has `DeckerComponent`
     - `CommandDispatcher` activates PENDING instances on first room entry
     - `MatrixTickSystem` syncs alert decay to `MissionInstance`
     - `InstanceCleanupSystem` (frequency 60) evicts ECS entities and soft-deletes DB records for resolved instances
     - `eliteOnly`/`corporationId` fields on `MobTemplate` (spawn logic wired as follow-on)
     - Safe-zone fields (`isSafeZone`, `safeZoneOverrideActive`) on `Room`
   - **Follow-on phases (not this slice):** mob aggro/follow system; body-guarding mechanic; elite mob spawn logic at RED alert; safe-zone enforcement in mob AI

---

## 4. Immediate Next Steps (Phase 4.4+)

**Merge and continue**

1. **Merge `feat/phase-4.3` to main** — all tests green, build clean; ready to merge.
2. **Remaining architecture candidates from `/improve-codebase-architecture` session:**
   - **Candidate 2:** Extract `PlayerEntityBuilder` to eliminate duplicated ECS entity construction between `CombatService.joinCombat` and `MatrixService.jackIn`.
   - **Candidate 3:** Fix `MissionService` → `matrixRepo` cross-domain call; move the inline `onNodeCreated` callback from `server.ts` into a named `MissionService` method.
   - **Candidate 4:** Evaluate folding `PresenceService` EventEmitter wrapper into `RoomPresence` directly.
3. **Elite mob spawn logic** — `MobTemplate.eliteOnly`/`corporationId` fields exist; spawn-at-RED trigger in `InstanceCleanupSystem` or a new `EliteSpawnSystem` is the next concrete task.
4. **Safe-zone mob AI enforcement** — `Room.isSafeZone` / `safeZoneOverrideActive` fields exist; mob AI should read `effectiveSafeZone = isSafeZone && !safeZoneOverrideActive` before targeting.
5. **Mob aggro/follow system** — room-to-room chase; safe-zone boundary enforcement; separate phase.
6. **Body-guarding mechanic** — tank actively shields a jacked-in decker's physical body; separate phase.
7. **Hotkey picker UI** — `CommandRegistry.getAll()` is ready; frontend component needed to let players configure hotkeys via dropdowns (accessibility requirement: full playability without typing).

**Remaining carry-forward items:**
- Snapshot history/admin tooling — no admin-facing snapshot history view yet
- Frontend lint debt in `client/src` (explicit `any`, React hook rules, static components declared during render)
- `WorldEventService` — `safeZoneOverrideActive` flag is wired at the DB level; a service to flip it during events is not yet implemented


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
