# Neon Requiem — Plan 04: Combat System

**Goal:** Implement the combat domain—AP/Recovery engine, combat style masteries, tiered hit resolution (Absorbs/Glancing), and the "On Guard" tactical system.

**Status:** Complete — 38/38 tests passing (15 new), combat logic implemented.

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

- [x] **Backstab (CQC):** Complex action, requires stealth, 2x-4x crit potential.
- [x] **Scattershot (Shotgun):** Complex, multi-target, power-based falloff.
- [x] **Aimed Shot (Rifle):** Complex, ignores % armor, higher crit chance.
- [x] **Trip (Whip/Unarmed):** Complex, adds delay to target.

---

## Task 6: Combat Service & Persistence

- [x] `combat.repository.ts`: Use a temporary store to track active fights per room.
- [x] `combat.service.ts`: Orchestrate actions and broadcast results to `SocketHub`.

---

## Completion Checklist

- [x] `npm test` — all tests passing (38/38)
- [x] `npx tsc --noEmit` — no errors.
- [x] Integration: Player can initiate combat, spend AP, and receive tiered absorb feedback.
