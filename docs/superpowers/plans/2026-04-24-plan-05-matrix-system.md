# Neon Requiem — Plan 05: Matrix System

**Goal:** Implement the Matrix domain—neural decking, node navigation, ICE combat, and real-world system manipulation (hacking).

**Status:** Draft

---

## The Core Concept: "The Virtual Overlay"

The Matrix is an abstract layer on top of the physical world. While some rooms are "dead air," many contain Matrix Nodes (Host systems) that can be accessed by those with a Cyberdeck or Technomancy resonance.

---

## File Map

```
src/
├── domains/
│   ├── matrix/
│   │   ├── matrix.types.ts      (NodeRecord, Program, IceRecord)
│   │   ├── matrix.service.ts    (Jack-in logic, Hacking actions)
│   │   ├── matrix.repository.ts (Node persistence)
│   │   └── matrix.routes.ts     (POST /matrix/action)
├── shared/
│   └── constants.ts             (MATRIX_ACTIONS, DUMPSHOCK_PENALTIES)
prisma/
└── schema.prisma                (MatrixNode model, Character neural link state)
```

---

## Task 1: Schema & Data Models

- [x] **MatrixNode Model:** `id`, `slug`, `securityLevel` (1-10), `hostType` (Public, Corporate, Military), `linkedRoomId` (for real-world effects).
- [x] **Programs:** Defined as Item type in schema.
- [x] **Character Update:** Add `isJackedIn` (boolean) and `activeNodeId`.
- [x] **Run Migration.**

---

## Task 2: Connection Logic (The Jack-In)

- [x] **Command:** `jack in`
    - Requires being in a room with an `isMatrixNode` flag.
    - Checks for equipped Cyberdeck (or Technomancer class).
    - Transitions player state to "Matrix Mode."
- [x] **Command:** `jack out`
    - **Graceful:** Implemented in service.
    - **Emergency:** Instant, but causes **Dumpshock** (physical damage).

---

## Task 3: Hacking Mechanics (The Matrix Move Set)

- [x] **Brute Force:** High success, but immediately sets node to **Alert: Red**.
- [x] **Sleaze:** Low success, keeps node at **Alert: Green**.
- [ ] **Data Spike:** Matrix attack against ICE or other Deckers.
- [ ] **Edit File / Command System:** The "Payoff".

---

## Task 4: ICE (Intrusion Countermeasures)

- [ ] **ICE Types:** 
    - **White ICE:** Passive, just blocks movement or slows actions.
    - **Gray ICE:** Attacks the Cyberdeck (lowers stats/recharges).
    - **Black ICE:** Lethal, deals damage to the Decker's physical HP.
- [ ] **Node State:** Green (Idling) -> Yellow (Searching) -> Red (Active ICE).

---

## Task 5: Frontend "Matrix Mode"

- [ ] **Visual Shift:** Apply a blue color-grading filter to the cinemagraphic panel when Jacked In.
- [ ] **Terminal Feedback:** Use a different prompt prefix (e.g., `[LINK] >`) and blue text colors for Matrix output.
- [ ] **Node View:** Display Node Security and Alert status in the left sidebar instead of the physical map.

---

## Completion Checklist

- [ ] Player can "jack in" to a room's node.
- [ ] Player can perform a "Sleaze" or "Brute Force" action against node security.
- [ ] Encountering ICE triggers Matrix combat (using Plan 04 logic but mental stats).
- [ ] Successful hack triggers a real-world effect (e.g., changing a room's name/description).
