# Neon Requiem - Project Handoff

**Date:** 2026-05-23
**Session focus:** Phase 4.4A safe-zone enforcement implemented and focused verification passed.

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
  - `npm test -- --silent`: passes, **25 suites / 146 tests** (all Phase 4.3 + architecture refactors + Neon District included).
- Verified backend result (2026-05-18):
  - `npm run build`: passes.
  - `npm test -- --silent`: passes, **25 suites / 146 tests**.
- Verified frontend/backend result (2026-05-18 debugging pass):
  - `cd client; npm exec -- tsc -b`: passes.
  - `cd client; npm run build`: passes.
  - `npm run build`: passes.
  - `npm test -- --silent`: passes, **25 suites / 146 tests**.
  - Socket repro: `select_character` + `look` remains connected; malformed command now emits `Command failed unexpectedly.` without disconnecting.
- Verified browser live test (2026-05-18, user-reported):
  - Fresh browser flow worked after DB reset and client hardening.
  - Character creation persisted well enough to enter the game.
  - `say` and `look` commands worked without hard disconnect.
  - Neon District traversal succeeded through the small playable area without blockers.
- Database reset (2026-05-18 debugging pass):
  - Requested account wipe completed against configured Postgres DB.
  - Final verified counts: `accounts = 0`, `characters = 0`.
- Phase 4.3 merge status:
  - `feat/phase-4.3` merged to `main` with merge commit `471fd50`.
  - `main` pushed to `origin/main`.
  - Handoff update committed before merge: `cd25a67 docs(handoff): update phase 4.3 handoff`.
- Verified pre-merge result (2026-05-23):
  - `npm run build`: passes.
  - `npm test -- --silent`: passes, **25 suites / 146 tests**.
  - `cd client; npm exec -- tsc -b`: passes.
  - `cd client; npm run build`: passes with Vite chunk-size/plugin-timing warnings only.
- Verified Phase 4.4A partial result (2026-05-23):
  - `npm run build`: passes.
  - `npm test -- --silent`: passes, **26 suites / 156 tests**.
  - Focused tests also pass:
    - `tests/world/world.service.test.ts`
    - `tests/combat/combat.service.test.ts`
    - `tests/engine/security-patrol.test.ts`
- Verified Phase 4.4A reinforcement completion (2026-07-12):
  - `npx jest --runInBand tests/engine/combat-system.test.ts tests/world/world.service.test.ts`: passes, **2 suites / 22 tests**.
  - `npm run build`: passes.
- Verified Phase 4.4A final backend result (2026-07-12):
  - `npm test -- --silent`: passes, **26 suites / 163 tests**.
  - `npm run build`: passes.

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

13. **Architecture Deepening Pass (2026-05-16):** Three candidates implemented from `/improve-codebase-architecture` session.

   **Candidate 1 — CommandRegistry seam:**
   - Replaced the monolithic `CommandDispatcher` if/else chain with a `CommandRegistry` + `CommandHandler` seam.
   - `CommandDispatcher` is now a thin 5-step router: parse → look up → resolve client → mode guard → execute (110 lines, down from 235).
   - Each command is its own class in `src/engine/commands/` with constructor-injected deps, `aliases`, `mode`, `label`, `description`, and `usage` metadata.
   - **Four execution modes enforced by the dispatcher:** `physical`, `matrix`, `wireless`, `any`.
   - Wireless class whitelist (`decker`, `technomancer`, `rigger`) checked via `CharacterClassComponent` — zero DB overhead.
   - `CommandRegistry.getAll()` enables the hotkey picker UI (accessibility: full play without typing).
   - `HelpHandler` renders dynamically from the registry.

   **Candidate 2 — PlayerEntityFactory:**
   - Extracted `PlayerEntityFactory.createFromRecord()` to eliminate duplicated 10-component ECS entity construction in `CombatService.joinCombat` and `MatrixService.jackIn`.
   - Factory owns canonical 9 base components; callers add context-specific components (Ap, CombatStatus, Decker) post-factory.
   - `CharacterClassComponent` now always present on player entities per Flavor Over Errors design decision.
   - `docs/CONTEXT.md` created with canonical domain vocabulary.

   **Candidate 3 — MissionService cross-domain boundary:**
   - `MissionService` previously called `matrixRepo.createMatrixNode()` directly (cross-domain DB call).
   - Fixed: `MatrixService.createInstanceNode()` wraps the repo call; `MissionService` now depends on `MatrixService` (same domain tier).
   - Inline 12-line `onNodeCreated` callback in `server.ts` moved into `MissionService.wireNodeToMissionTargets(roomId, nodeEntityId)`.
   - `server.ts` callback reduced to a one-liner; `ComponentTypes`/`MissionTargetComponent` imports removed from `server.ts`.
   - 2 new tests for `wireNodeToMissionTargets`.
   - 25 suites / 142 tests green.

14. **Hardening + Client Debugging Pass (2026-05-18):**

   **Auth middleware — JWT error → 401:**
   - `src/domains/auth/auth.middleware.ts`: `extractAuthPayload` now wraps `verifyToken()` in try/catch and re-throws as `UnauthorizedError`.
   - Previously, `TokenExpiredError` / `JsonWebTokenError` (jsonwebtoken library, not `AppError` subclasses) escaped the catch block and Fastify returned 500. Now returns clean 401.

   **xterm terminal crash / hard disconnect on input:**
   - `client/src/components/Terminal.tsx`: queues all imperative writes until xterm has completed a non-zero-size `fit()`.
   - Initialization now retries via `requestAnimationFrame` until the flex container has real dimensions, then flushes queued writes.
   - `onData` now calls the latest `onInput` through a ref; previously the terminal kept the first render's stale callback, which could miss the connected socket state.
   - All xterm writes are wrapped so renderer failures are logged instead of crashing the React tree and unmounting the socket.
   - Cleanup cancels the pending frame, clears queued writes, and marks the terminal not ready.

   **Client API/socket base URL:**
   - Added `client/src/lib/api.ts` with shared `API_BASE_URL` / `apiUrl()`.
   - `useAuth`, `useSocket`, and `CharacterView` now use the same base URL.
   - Removed stale hardcoded WSL gateway `172.19.176.1`; this was a concrete cause of "characters disappeared" during testing because the live WSL address had changed to `172.19.181.59`.

   **Socket command guard:**
   - `src/server.ts`: socket `command` listener now wraps `commandDispatcher.dispatch()` in an outer try/catch.
   - Unexpected command failures emit `Command failed unexpectedly.` and keep the socket connected.
   - Repro confirmed normal `look` input and malformed command input both leave the socket connected.

   **WSL2 → Windows Postgres connectivity (env note, not a code change):**
   - `127.0.0.1` does not reach Windows Postgres from WSL2. Windows host IP is `$(ip route show default | awk '{print $3}')`.
   - Required: Windows Firewall inbound rule on the Postgres port; `pg_hba.conf` entry `host all all 172.16.0.0/12 scram-sha-256`; then `SELECT pg_reload_conf()`.
   - `.env` `DATABASE_URL` must use the Windows host IP, not `localhost`.

12. **Phase 4.3 — Mission Instancing, Physical Body Persistence & Alert Escalation (COMPLETE, 2026-05-16):**
   - Branch: `feat/phase-4.3` (merged to `main`, 2026-05-23)
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

15. **Phase 4.4A — Safe-Zone Enforcement Foundation (COMPLETE, 2026-07-12):**
   - Plan: `docs/superpowers/plans/2026-05-23-phase-4.4a-safe-zone-enforcement.md`
   - Metadata convention added to the plan doc for graph/search friendliness: phase, status, dependencies, enabled future work, domains, and systems.
   - Scope decision:
     - Block automated hostile NPC behavior in normal safe zones.
     - Do **not** change player-initiated combat, PvP rules, rewards, event recruitment, faction allegiance, elite spawns, or full aggro/follow behavior in this slice.
   - Canonical policy:
     - `effectiveSafeZone = room.isSafeZone && !room.safeZoneOverrideActive`
     - The policy belongs in the World domain because it governs zone-specific behavior flags.
   - Enforcement decisions:
     - Add a world-domain helper/service lookup so callers do not duplicate flag logic. **Done.**
     - Gate automated alarm triggering so effective safe zones do not create/mutate combat sessions into RED escalation. **Done.**
     - Gate reinforcement spawning as a second check, so stale sessions or event flag changes cannot spawn hostile mobs after protection resumes. **Done.**
     - Blocked automated alarms should be clean no-ops with explicit results and should not mark rooms clean. **Done.**
   - Implemented:
     - `src/domains/world/world.types.ts`: added `isEffectiveSafeZone(room)` using `room.isSafeZone && !room.safeZoneOverrideActive`.
     - `src/domains/world/world.service.ts`: added `WorldService.isEffectiveSafeZone(roomId)`, throwing `NotFoundError('Room')` for missing rooms to match existing world lookup behavior.
     - `src/domains/combat/combat.types.ts`: added `SecurityAlarmResult`.
     - `src/domains/combat/combat.service.ts`: `triggerSecurityAlarm(roomId)` now owns safe-zone alarm blocking through the world-domain safe-zone policy and checks before `getOrCreateEcsSession`.
     - `src/engine/security-patrol.ts`: patrol reacts to the explicit alarm result, logs safe-zone skips, and reports triggered/skipped counts without knowing safe-zone flags.
     - `src/engine/ecs/systems/combat-reinforcement-system.ts`: reinforcement spawning checks a narrow safe-zone policy, clears blocked pending timers, and preserves override/non-safe behavior.
     - `src/server.ts`: supplies `WorldService` to the reinforcement system as the safe-zone policy implementation.
     - Tests added/updated:
       - `tests/world/world.service.test.ts`
       - `tests/combat/combat.service.test.ts`
       - `tests/engine/security-patrol.test.ts`
       - `tests/engine/combat-system.test.ts`
   - Architecture note:
     - `/improve-codebase-architecture` review recommended making `triggerSecurityAlarm` the deep module for alarm blocking. Implemented: safe-zone checks, ECS session creation ordering, RED mutation, and no-op result all sit behind the alarm interface.
   - Deferred event behavior:
     - Future hostile safe-zone events may set `safeZoneOverrideActive = true` for affected rooms.
     - Event-specific logic may enable alarm-like behavior, but civic-defense events should be able to spawn friendly/allied security NPCs who fight alongside recruited players rather than hostile law/security mobs.
     - Event lifecycle, faction allegiance, friendly NPC support, recruitment, participation rewards, and cleanup guarantees are deferred to later event-system phases.

16. **Phase 4.4B — Physical Mob AI Targeting (SLICE 2 COMPLETE, 2026-07-12):**
   - Plan: `docs/superpowers/plans/2026-07-12-phase-4.4b-mob-ai-targeting.md`
   - First vertical slice:
     - Added `MobAiSystem` as a heartbeat subscriber for hostile physical NPC behavior.
     - Hostile NPCs select and attack valid player targets in the same non-safe physical room.
     - Effective safe zones suppress automated mob attacks.
     - Jacked-in deckers are targetable by `DeckerComponent.physicalRoomId`, keeping physical bodies vulnerable while the decker is in the Matrix.
     - Mob attacks resolve through the existing `MoveDispatcher` and `AttackExecutor`.
     - Reinforcement and mission-target mobs now spawn with hostile AI state.
     - AP-starved hostile mobs enter recovery so they can keep attacking after `CombatTickSystem` refills AP.
     - `SafeZonePolicy` is now a shared World-domain contract consumed by alarm, reinforcement, and mob AI systems.
   - Second vertical slice:
     - Hostile mobs retain targets between ticks and can follow an existing target into an adjacent non-safe room.
     - Hostile mobs drop their target instead of crossing into an effective safe zone.
     - Pursuit uses World service room lookup and does not attack on the same tick as movement.
     - Physical movement/navigation handlers sync active player ECS `PositionComponent` values after successful movement, so pursuit follows runtime movement instead of stale ECS location.
   - Deferred follow-ons:
     - Multi-room chase/pathfinding and alert-expanded patrol routes.
     - Body-guarding/interception for jacked-in deckers.
     - RED-alert elite mob spawning.
     - Combat log/broadcast output for autonomous NPC attacks.

17. **Phase 4.4C — RED-Alert Elite Spawns (COMPLETE, 2026-07-12):**
   - Plan: `docs/superpowers/plans/2026-07-12-phase-4.4c-red-alert-elite-spawns.md`
   - Implemented:
     - `MobRepository.findEliteByCorporation(corporationId)` looks up elite-only templates by corporation behind the Combat domain service seam.
     - `CombatReinforcementSystem` reads `Room.factionOwner` through the World room lookup when a RED-alert reinforcement timer matures.
     - RED-alert reinforcement resolution spawns ordinary security plus a matching elite template when one exists.
     - Non-RED reinforcement resolution does not query or spawn elite templates.
     - Missing ordinary security guard templates do not produce elite-only fallback spawns.
     - RED-alert room ownership lookup failures surface for retry/diagnosis instead of silently hiding bad ownership data.
     - Elite mobs spawn with hostile AI state and therefore participate in the Phase 4.4B mob AI loop.
   - Deferred follow-ons:
     - First-class corporation/facility ownership on `MissionInstance`.
     - Weighted selection among multiple elite archetypes.
     - RED-alert elite spawns across every active/player-occupied instance room.

---

## 4. Immediate Next Steps (Phase 4.4+)

**Phase 4.4A and 4.4B are committed; Phase 4.4C is implementation-complete**

1. Verify and commit the Phase 4.4C implementation and documentation when ready.
2. Follow-on after 4.4C:
   - Multi-room mob chase/pathfinding and alert-expanded patrol routes
   - Body-guarding mechanic for jacked-in deckers
   - Hotkey picker UI from `CommandRegistry.getAll()`

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
Client API target:
- Default frontend API/socket base is `http://localhost:3000`.
- Override with `VITE_API_BASE_URL=<backend-origin>` when testing from Windows browser against a WSL-hosted backend.
Verification:
- Backend: `npm run build`; `npm test -- --silent`
- Frontend typecheck: `cd client; npm exec -- tsc -b`
- Frontend bundle: `cd client; npm run build` under Node 22 with dependencies installed for the current platform
- Current shell note: if `node -v` reports `v20.20.2`, prepend Node 22 explicitly:
  ```bash
  PATH=/home/bdgibby/.local/share/fnm/node-versions/v22.22.2/installation/bin:$PATH <command>
  ```
