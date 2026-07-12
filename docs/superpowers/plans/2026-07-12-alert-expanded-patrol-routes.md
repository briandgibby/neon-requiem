# Phase 4.4E Plan: Alert-Expanded Patrol Routes

---
phase: 4.4E
status: complete
depends_on:
  - 4.4B
domains:
  - engine
  - combat
  - world
systems:
  - alert-patrol
  - mob-ai
  - safe-zone-policy
---

**Date:** 2026-07-12
**Status:** Complete
**Reference:** Phase 4.3 alert behavior: YELLOW patrol sweeps and RED broad patrol coverage

---

## Goal

Let physical security patrols react to active alert rooms without building a full facility scheduler yet.

---

## Slice 1 — ECS Alert Patrol Movement

Implemented:

- Add an ECS `AlertPatrolSystem` for NPCs with `AiComponent.state = 'patrol'`.
- YELLOW alert sessions pull patrols along their authored room-id `patrolRoute` toward the alerted room.
- RED alert sessions can pull patrols through connected non-safe rooms even when no explicit route is authored.
- RED graph search is bounded to eight room transitions per heartbeat tick; farther alerts are treated as outside immediate patrol response range.
- Patrol movement is one room per heartbeat tick and does not start in or cross effective safe-zone rooms.
- Patrols that arrive in the alerted room become `hostile`, allowing the existing `MobAiSystem` to handle target selection and attacks.
- `AlertPatrolSystem` is subscribed to the same server heartbeat cohort as reinforcement spawning and mob AI; the heartbeat runs eligible subscribers concurrently, so the state handoff is tick-based rather than sequence-ordered.
- Room and safe-zone lookup failures are reported through diagnostics while the affected patrol is isolated from the rest of the heartbeat.

Deferred:

- MissionInstance-wide alert source integration beyond ECS `CombatSessionComponent`.
- Patrol broadcast/combat log output.
- Weighted or randomized patrol-route selection.
- Persisted patrol definitions in world content.

---

## Test Plan

- [x] GREEN sessions do not move patrols.
- [x] YELLOW sessions move patrols one step along an authored route toward the alert room.
- [x] RED sessions move patrols one step through connected non-safe rooms without requiring an authored route.
- [x] Patrols do not start in or cross effective safe-zone rooms.
- [x] Patrols do not skip non-adjacent rooms in authored YELLOW routes.
- [x] Patrols do not traverse id-valued exits during RED expansion.
- [x] RED alerts beyond the bounded eight-transition patrol search range are ignored for immediate movement.
- [x] Lookup failures are reported without stopping other patrols.
- [x] Patrols become hostile after reaching an alerted room.
