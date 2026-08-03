# Street Doc Field Medicine Slice

---
phase: class-fantasy
status: planned
depends_on:
  - PlayerRuntime
  - CombatService
  - command-picker
domains:
  - medical
  - combat
  - engine
  - client
systems:
  - player-runtime
  - command-registry
  - game-view
---

**Date:** 2026-08-03
**Status:** Planned
**Reference:** First class-fantasy slice after the playable mission loop

---

## Goal

Make the Street Doc the first fully playable support role. A Street Doc and an injured ally in the same physical room can complete a persistent, resource-backed field treatment through the normal command and picker surfaces.

## Tracer Bullet

1. A Street Doc selects an injured ally from the room-local ally picker.
2. `treat <ally>` validates ownership, class, location, health state, and the selected Tech or Magic path.
3. The treatment atomically spends mana or medical supplies, restores HP, and writes an audit event.
4. The shared Player Runtime immediately reflects the new vitals for combat and room clients.
5. Reconnecting reloads the same persisted HP and resource totals.

## Scope

- Replace unowned character lookups with account-owned actor access and same-room target validation.
- Preserve the existing Street Doc path distinction: Magic spends mana; Tech consumes medical supplies.
- Move resource spend, healing, and audit logging into one repository transaction.
- Use ECS health as the live combat authority and synchronize the committed result with persistence.
- Add a `treat <ally>` command and reuse the combat ally argument source in the command picker.
- Emit room-local treatment feedback plus updated actor and target vitals.
- Cover service rules, transaction rollback, runtime synchronization, reconnect persistence, and one command-level integration flow.

## Non-Goals

- Truth serum and interrogation outcomes.
- Combat stim buffs, crashes, or a generalized effect system.
- Combat revival and death-sickness tuning.
- Additional magic traditions, mentor spirits, or broader class progression.

## Acceptance Criteria

- Only an owned Street Doc can initiate treatment.
- Actor and target must be distinct player characters in the same physical room.
- Full-health, missing-resource, stale-location, and invalid-path requests fail without partial writes.
- Successful treatment never exceeds the target's maximum HP and reports the actual HP restored.
- Concurrent treatment cannot overspend mana or consume the same final supply twice.
- Database vitals and the target's runtime Health component agree after success.
- The command picker offers only eligible room-local allies and reconnect preserves the result.

## Verification

- Focused MedicalService and MedicalRepository tests.
- Player Runtime synchronization regression tests.
- Command handler integration test from picker argument to persisted/runtime health.
- Backend build and full Jest suite.
- Client lint, production build, and browser verification of the treatment flow.
