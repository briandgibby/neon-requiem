# Neon Requiem — Project Handoff
**Date:** 2026-04-26  
**Session focus:** Matrix Refinement, Magic, Medical, Social, Security Response, and Character Creation.

---

## 1. Major Systems Implemented

### **The Matrix (Plan 05)**
- **ICE Combat:** Implemented White, Gray, and Black ICE with unique behaviors (Stun, Program Corruption, Biofeedback).
- **Program Integrity:** Added a tiered corruption system (0–3) for software.
- **Neural Load:** Introduced the **Stun Track**. Dumpshock now deals Stun damage, which overflows into Physical damage if the track is full.
- **Neural Hardening:** Resistance rolls using `Deck Firewall + Logic` to deflect digital attacks.

### **Magic System (Plan 06)**
- **Hybrid Engine:** Traditional **Mana Pool** for standard spells; **Overcasting** (direct Physical damage) as an emergency fallback.
- **Reagent Economy:** Reagents act as "Mana Potions" providing a HoT (Heal over Time) effect.
- **Salvaging:** Players can break down unwanted items into Reagents directly in the field for mid-mission sustain.
- **Adept Auras:** Frontline-capable buffers who sustain team-wide effects at the cost of Mana capacity.

### **Street Doc / Medical (Plan 07)**
- **Dual-Path Healing:** Branching into **Magic-based** (Mana-heavy) or **Tech-based** (Supply-heavy) specialization.
- **Combat Revival:** Spending a point of the permanent **Luck** stat to revive fallen teammates.
- **Mission Utility:** Truth Serum for NPC interrogation scenes.

### **Social / Face (Plan 08)**
- **Origin-Based Autonomy:** Factions re-framed as backstory Origins (Corp vs. Shadow).
- **SIN System:** High-security zones enforce legal status checks. SINless characters trigger auto-aggro unless utilizing a **Disguise**.
- **Smooth Talk:** Using Charisma + Dumb Luck to manipulate NPC disposition.

### **Security Response & NPC Autonomy (Plan 09)**
- **Dynamic Reinforcements:** AAA zones respond in 3-5 turns; C zones in 20.
- **Janitorial Stealth:** Combat leaves blood and bodies (`isClean = false`). Failure to use **C-Squared** or **Body Bags** eventually triggers site-wide alarms.
- **Audit Logging:** Robust tracking of item drops and transactions to prevent cliquish hoarding and exploits.

### **Urban Overworld & Commlink (Plan 12)**
- **Static Grid Sprawl:** Replaced tree-layout with a realistic city grid.
- **The Commlink:** A smartphone-style frontend UI showing current sectors and local POIs.
- **Auto-Pathing:** BFS-based `navigate` action allowing players to automatically walk to known locations.

### **Character Initialization (Plan 13)**
- **Karma Point Buy:** 50 starting Karma with non-linear costs (escalating past level 5 and 9).
- **Racial Caps:** Strict enforcement of floors/caps for all 12 races.
- **Derived Stats:** HP, Stun, and Mana now scale dynamically based on Body, Strength, Willpower, and Logic.

---

## 2. Technical Parity & Known Issues

- **Build Status:** Backend and Frontend both pass `npm run build`.
- **Frontend Mapping:** Fixed a major discrepancy where the server returned `{ accountId, username }` but the client expected `{ user: { ... } }`.
- **Loosened Validation:** Temporarily reduced character requirements for username/password to "1 character" to facilitate rapid account testing.
- **White Screen Fix:** Resolved several TypeScript and iterator errors that were causing the React client to fail on load.

---

## 3. Next Steps

1.  **Mission Content:** We have the generator and templates (Retrieval, Sabotage), but need to build out the specific room layouts and NPC spawn tables for the instances.
2.  **The Shop System:** Implement the "Crime Mall" / Black Market vendors where players can finally spend Nuyen on Cyberdecks and Weapons.
3.  **UI Vitals Update:** Ensure the newly implemented SIN status and Aura effects are visible in the HUD.
4.  **Database Migration:** A `npx prisma db push` was performed to sync the schema; a proper migration should be generated for the next deployment.

---

## 4. Environment Notes
- **Backend:** Port 3000
- **Frontend:** Port 5174 (if 5173 is occupied)
- **DB:** Postgres on Port 5435
