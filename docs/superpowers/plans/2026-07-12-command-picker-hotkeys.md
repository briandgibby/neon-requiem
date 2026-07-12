# Command Picker Hotkey Slice

---
phase: 4.4-ui
status: complete
depends_on:
  - CommandRegistry
domains:
  - engine
  - client
systems:
  - command-registry
  - game-view
---

**Date:** 2026-07-12
**Status:** Complete
**Reference:** Handoff follow-on: hotkey picker UI from `CommandRegistry.getAll()`

---

## Goal

Expose registered command metadata to the client and render a mode-aware command picker so players can discover and run commands without memorizing syntax.

---

## Implemented

- Added a command metadata serializer over `CommandRegistry.getAll()`.
- Added authenticated `GET /api/commands` route returning safe command metadata only.
- Added a client `CommandPicker` component that filters commands by physical vs. matrix mode.
- Commands without usage run directly from picker buttons; commands with usage can be selected and composed with an argument field.
- Picker command composition preserves alias-only commands such as movement directions, so entering `e` for Move sends `e` instead of `n e`.

---

## Deferred

- Persisted per-character hotkey mappings.
- Entity-aware dropdowns for argument selection, such as ICE IDs for `spike`.
- Drag/drop or keyboard remapping UI.

---

## Test Plan

- [x] Command metadata serialization exposes labels, modes, descriptions, aliases, and usage without executors.
- [x] Authenticated command metadata route returns the command catalog and rejects missing auth.
- [x] Backend TypeScript build verifies the command metadata route composition.
- [x] Client production build verifies the picker UI and API fetch integration.
- [x] Browser verification: registered a local test account/persona, confirmed the picker renders in the physical game view, and confirmed Move + `e` moves east from The Pit to Black Market Alley.
