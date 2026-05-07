# Neon Requiem Learning Log

This log captures process lessons during each phase: what worked, what went wrong or nearly went wrong, and what we will do differently to avoid regression hell.

## Phase 0 — Source Of Truth Cleanup

Date: 2026-04-28

### Good

- Re-read operative docs and key code before changing project guidance.
- Verified backend state with real commands instead of trusting stale plan checkboxes.
- Corrected stale docs before implementing new features.
- Used `git diff --check` on edited docs and fixed whitespace issues.
- Explicitly labeled frontend WSL build failure as likely dependency/environment related instead of claiming source failure.

### Bad / Risks Observed

- A copied `HERMES.md` from another repo contained incorrect project-specific guidance. This could have steered future agents into wrong assumptions.
- Several plan checklists overstated completion status compared with reachable/tested code.
- Pre-existing modified files made authorship ambiguous; future work must avoid sweeping edits.
- Frontend build verification differs by environment; WSL Node 20 plus missing Rolldown optional binding can produce misleading failure signals.

### Process Improvements

- Keep `HERMES.md`, `docs/HANDOFF.md`, and plan statuses synchronized after every phase.
- Treat plan checkboxes as historical hints, not facts, until code and tests confirm them.
- Record both successes and mistakes in this file during each phase.
- Before implementation phases, capture git status and use focused diffs to avoid overwriting unrelated work.

## Phase 1 — Real Multiplayer Presence MVP

Date: 2026-04-28

### Goal

Two browser sessions can select characters, meet in the same room, see each other, and use local chat/basic room commands without regressing backend build/tests.

### Guardrails

- Use TDD for production behavior changes.
- Start with a testable presence helper instead of embedding all state transitions directly in Socket.IO callbacks.
- Keep the first slice small: selected character state, room membership, occupants, enter/leave, `look`, `who`, `say`, `tell`, `help`.
- Do not expand combat/matrix/shop work during this phase.
- Run focused tests first, then backend build and full backend tests.

### Good

- Pending.

### Bad / Risks Observed

- Existing socket command handling is inline in `src/server.ts`, making behavior harder to test directly.
- Existing SocketHub tracks accounts, not selected characters or room membership.
- Duplicate sessions are evicted, but room cleanup for selected characters does not exist yet.
- Presence state must not leak private character/account details globally.

### Process Improvements

- Pending.
