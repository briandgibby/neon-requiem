# Neon Requiem — Plan 04: Combat System

**Goal:** Implement the combat domain—AP/Recovery engine, combat style masteries, tiered hit resolution (Absorbs/Glancing), and the "On Guard" tactical system.

**Status:** Partially implemented / stale checklist — backend build and tests currently pass, and core combat math/service logic exists. However, several checklist items below overstate the current implementation: named moves are not fully implemented as distinct behaviors, combat results are not broadcast through SocketHub, and live multiplayer combat lifecycle/concurrency work remains.

**Verified 2026-04-28:** root `npm run build` passes; root `npm test -- --silent` passes with 9 suites / 50 tests.

**Remaining before this plan can be considered complete:** align route schema with service moves, add room-local Socket.IO combat broadcasts, implement/verify named moves or mark them deferred, handle combat end/cleanup/rewards, and harden JSON session concurrency.

---

## File Map

```
src/
├── shared/
│   ├── types.ts          (updated — CombatMove, CombatStatus)
│   └── constants.ts      (updated — AP_COSTS, ABSORB_MULTIPLIERS, DAMAGE_VARIANCE)
├── domains/
│   ├── combat/
│   │   ├── combat.types.ts      (CombatSession, HitResult, MoveInput)
│   │   ├── combat.math.ts       (Hit resolution, Soak, and Absorb logic)
│   │   ├── combat.repository.ts (In-memory/Cache for active fights)
│   │   ├── combat.service.ts    (Main logic: attack, move, flee, guard)
│   │   └── combat.routes.ts     (POST /combat/action)
│   ├── character/
│   │   ├── character.types.ts   (updated — Style Mastery and HP fields)
│   │   └── character.service.ts (updated — initialize masteries and HP)
tests/
└── combat/
    └── combat.math.test.ts
    └── combat.service.test.ts
prisma/
└── schema.prisma                    (Mastery, HP, and ArmorValue fields added)
```

---

## Task 1: Character & Item Schema Updates

- [x] Update `Character` Prisma model: Add `masteryCQC`, `masteryEdge`, `masteryImpact`, `masteryPistol`, `masteryRifle`, `masteryAutomatic`, `masteryRigging`, `masterySummoning`.
- [x] Update `Character` Prisma model: Add `currentHp`, `maxHp`, `armorValue`.
- [x] **Run migration** and **Generate client**.

---

## Task 2: The AP & Recovery Engine

- [x] Implement `AP Pool` logic:
    - Default Max AP = 6.
    - **Command Penalty:** -2 Max AP while Drone/Spirit is active.
- [x] Implement `Recovery Phase`:
    - AP refills once the pool is empty or the player chooses to "Rest."
    - Recovery time scales with `intP` (Intuition + Dexterity).
- [x] Implement **Free Actions (0 AP)**:
    - Consumables can be used during recovery.
    - 2-second internal "chug" cooldown.

---

## Task 3: "On Guard" & Counter-Strike System

- [x] Implement **Stance Stalling**:
    - Spending 1 AP to go `On Guard`.
    - Bonuses: Higher Glancing Blow window + 20% Damage Reduction.
- [x] Implement **Riposte / Counter-Strike**:
    - Triggered on Dodge or Glancing Blow while `On Guard`.
    - Counter deals 50% DMG.

---

## Task 4: Hit Resolution Engine (`combat.math.ts`)

- [x] **Hit Logic:** Calculate Full vs Glancing vs Dodge.
- [x] **Damage Variance:**
    - **Solid Hit:** 81% – 100% of base DMG.
    - **Glancing Blow (Graze):** 10% – 20% of base DMG. No crit eligibility.
- [x] **Critical Multipliers:**
    - Clean multipliers (2x, 3x, 4x, 5x) applied to the varied damage.
    - Move/Weapon specific ceilings (e.g., Backstab up to 4x, Elite Snipers up to 5x).
- [x] **Armor Absorption:**
    - Roll for `None`, `Some` (20-40% reduction), or `Most` (50-70% reduction).
    - Logic weighted by `Weapon Power` vs `Target Armor`.

---

## Task 5: Initial Move Set (v1)

- [~] **Backstab (CQC):** Planned named move; not yet verified as a distinct implemented behavior.
- [~] **Scattershot (Shotgun):** Planned named move; not yet verified as a distinct implemented behavior.
- [~] **Aimed Shot (Rifle):** Planned named move; not yet verified as a distinct implemented behavior.
- [~] **Trip (Whip/Unarmed):** Planned named move; not yet verified as a distinct implemented behavior.

---

## Task 6: Combat Service & Persistence

- [x] `combat.repository.ts`: Use a temporary store to track active fights per room.
- [~] `combat.service.ts`: Orchestrate actions. SocketHub room-local combat broadcasts remain to be implemented.

---

## Completion Checklist

- [x] Backend build currently passes: root `npm run build`.
- [x] Backend tests currently pass: root `npm test -- --silent` (9 suites / 50 tests).
- [~] Integration: Player can initiate combat and spend AP through backend routes/services, but live room-local combat feedback, encounter lifecycle, cleanup/rewards, and concurrent play safety remain unfinished.
