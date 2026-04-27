# Neon Requiem — Game Design Specification
**Date:** 2026-04-17  
**Status:** Approved  
**Type:** Spiritual successor to Realms of Kaos, set in a cyberpunk-fantasy universe

---

## 1. Project Overview

**Neon Requiem** is a hybrid graphical/text multiplayer online RPG (MUD) inspired by Realms of Kaos (1996–2013), reimagined in a cyberpunk-fantasy setting drawing from the broader genre vocabulary of cyberpunk and urban fantasy. It is not a licensed product. All factions, corporations, gangs, and named NPCs are original creations. Genre-common terminology (decker, street samurai, nuyen, awakened) is used freely.

### Design Goals
- Preserve what made RoK beloved: deep class/race system, meaningful PvP, rich world, tight community, staff-run events
- Correct RoK's core failures: flat-file lag, alt abuse, lack of endgame content, weak death penalties
- Modernize the platform: browser-accessible, no proprietary client required, open source stack
- Create a living world that rewards social play, preparation, and faction loyalty

---

## 2. Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 LTS |
| WebSockets | Socket.IO |
| HTTP/REST | Fastify |
| Database | PostgreSQL 16 + pgBouncer |
| ORM | Prisma |
| Frontend | React + xterm.js (terminal emulator) |
| Auth | JWT + bcrypt |
| Process management | PM2 |
| Testing | Jest (unit/integration), Artillery or k6 (load) |

All dependencies are open source.

### Architecture Pattern: Modular Monolith

Single deployable Node.js server with strict internal domain boundaries. Domains communicate only through defined service interfaces — no cross-domain direct database queries. Chosen over microservices to avoid distributed systems complexity at this stage, and over a pure monolith to support future contributor ownership of distinct domains.

### Project Structure

```
src/
├── domains/
│   ├── auth/          # login, registration, JWT sessions
│   ├── character/     # creation, stats, progression, class/race
│   ├── world/         # rooms, zones, security ratings, automap
│   ├── combat/        # physical PvP/PvE engine, tick loop
│   ├── matrix/        # decker/technomancer abilities, ICE, nodes
│   ├── magic/         # traditions, mentor spirits, spells, drain
│   ├── economy/       # inventory, nuyen, crafting, enchanting
│   ├── loot/          # drop tables, rarity tiers, unique item gen
│   ├── social/        # factions, gangs, divisions, chat, bounties
│   └── events/        # scheduled events, world bosses, seasonal
├── engine/            # game loop, tick system, WebSocket hub
└── shared/            # types, constants, utilities, errors
```

### Frontend
- Terminal-aesthetic browser client: black background, monospace font, scrolling text output, command input line
- Optional graphical panel: small sprite/tile sidebar for room art and character portraits
- Desktop client: Electron wrapper around the web client for a richer optional experience
- Mobile: not a launch target

### Performance Notes
RoK suffered severe lag from flat .dat file storage under concurrent load. Neon Requiem addresses this directly:
- PostgreSQL with indexed queries replaces all flat-file state
- pgBouncer connection pooling handles concurrent player connections
- Game state for active sessions cached in memory; persisted to DB on tick/event
- No polling — all real-time updates via WebSocket push

---

## 3. World & Setting

### Tone
Cyberpunk-fantasy. Megacorporations dominate society. Magic returned to the world generations ago (the Awakening), transforming some humans into metahuman races and allowing the rise of awakened practitioners. Technology and magic coexist uneasily. The sprawl is layered: gleaming corporate arcologies above, teeming barrens below.

### Geography
Multiple megacity sprawls connected by wasteland corridors. Each city contains:
- Corporate district (AAA/AA security)
- Business and residential zones (A/B/C security)
- Barrens and industrial ruins (D security)
- Forbidden zones and black sites (Z / no-sec)

### Starting Cities
- **Corp-aligned city:** Gleaming arcology hub. Starting point for Wage Slaves. Corp vendors, Division offices, legal markets.
- **Shadow-aligned city:** Undermarket sprawl. Starting point for Street Scum. Shadow vendors, Gang halls, black markets.

### Room System
- Thousands of rooms across districts, sewers, rooftops, matrix nodes, wilderness, and instanced missions
- Each room carries: security rating, faction ownership, matrix presence flag, NPC spawn table
- Automap tracks player exploration
- Day/night cycle affects NPC spawn rates, some mentor spirit bonuses, and street visibility

### Mission Rooms
- Instanced per-party, generated from templates
- Not shared world space — private to the contracting party
- Always flagged PvP regardless of zone security rating
- Reset on re-entry; cleared on completion

---

## 4. Factions

Two player factions chosen at character creation. Affects starting city, base class name, NPC disposition, faction-exclusive missions, and social organization type.

| Faction | Base Class | Social Unit | Starting City |
|---------|-----------|-------------|---------------|
| **Shadow** | Street Scum | Gang | Shadow-aligned sprawl |
| **Corp** | Wage Slave | Division | Corp-aligned arcology |

- Base class (Street Scum / Wage Slave) held until level 8, then promotion to chosen class path
- Class path selected at character creation — determines progression trajectory from level 1
- Faction rivalry plays out in D/Z zones and contested turf

---

## 5. Races

12 races total: 6 base races, each with one subrace. No hard class restrictions — stat ceilings gate class viability naturally. Math (HP formulas, melee damage formulas) tuned in future versions as needed.

### Stat System

**Scale: 1–12.** Cyberware and magical buffs can exceed racial caps. Magical buffs are temporary and cost combat actions.

**9 base stats:**

| Group | Stat | Role |
|-------|------|------|
| Physical | Body | HP, damage soak, cyberware capacity |
| Physical | Agility | Attack accuracy, ranged/melee THAC0 |
| Physical | Dexterity | Reflexes; feeds Int-P (replaces Reaction) |
| Physical | Strength | Melee damage, carry weight |
| Mental | Logic | Feeds Int-M; matrix/tech ceiling |
| Mental | Intuition | Feeds Int-M and Int-P |
| Mental | Willpower | Drain resist, mental defense |
| Mental | Charisma | Face actions, NPC disposition, Luck recovery rate |
| Special | Luck | Dual-facet — see below |

**Conditional stats:**
- **Bio-Sync** (renamed from Essence) — starts at a race-specific value; reduced by cyberware installation; Magic/Resonance cannot exceed current Bio-Sync
- **Magic** — Awakened classes only
- **Resonance** — Matrix classes only

**Derived stats (server-side calculated):**
- **Int-P** (Physical Intuition) = Intuition + Dexterity → initiative, action pool size, dodge assessment, armor degradation baseline
- **Int-M** (Mental Intuition) = Intuition + Logic → trap detection, matrix auth bypass, node manipulation, skill-check events

**Luck — Dual-Facet Stat:**
- **Luck (base):** 1–12 stat; recovers fully after each combat. Charisma affects recovery rate between combats.
- **Dumb Luck (substat):** Derived from current Luck. Governs favorable positioning (cover availability, retreat options, ambush mitigation when team loses initiative) and passively boosts Face success rolls. Decreases as Luck Pool is spent.
- **Luck Action Pool:** Spendable points; spending lowers base Luck which lowers Dumb Luck by proxy.
  - Last resort — avoid incoming killshot
  - Street Doc combat revival window
  - Slip away — disengage when retreat is otherwise blocked
  - Clutch reload — instant reload action outside turn order
  - Second wind — recover a small amount of HP once per combat

### Racial Stat Ranges

All stats shown as Floor/Cap. Cyberware and magical buffs can push past cap (except where noted).

| Race | Body | Agility | Dex | Str | Logic | Int | Will | Cha | Luck | Bio-Sync | Racial Traits |
|------|------|---------|-----|-----|-------|-----|------|-----|------|----------|---------------|
| **Human** | 1/6 | 1/6 | 1/6 | 1/6 | 1/6 | 1/6 | 1/6 | 1/6 | 1/7 | 6 | Balanced. Best Luck cap of any non-Halfling race. |
| **Surge** | 1/5 | 2/7 | 2/7 | 1/5 | 1/6 | 2/7 | 1/6 | 1/6 | 1/7 | 6 | Partially awakened. Ware costs +10% Bio-Sync. Strong Magic/Resonance candidates. |
| **Elf** | 2/5 | 3/7 | 2/7 | 1/6 | 2/7 | 1/7 | 1/6 | 4/8 | 2/6 | 7 | Highest natural Bio-Sync. Grace and social mastery. Fragile Body cap. |
| **Dark Elf** | 2/6 | 1/7 | 2/7 | 3/7 | 1/7 | 3/6 | 2/7 | 1/5 | 1/5 | 7 | Trades Elf's Cha dominance for Str/Will/Logic floors. |
| **Dwarf** | 3/8 | 2/5 | 3/7 | 3/7 | 1/6 | 1/7 | 2/7 | 1/5 | 1/5 | 5 | Hardy. Thermographic vision. Low Bio-Sync limits magic access. Agility cap 5 is a hard ceiling. |
| **Gnome** | 1/4 | 4/8 | 3/7 | 1/4 | 4/8 | 3/8 | 1/6 | 1/7 | 1/6 | 6 | Highest Logic + Intuition caps in game. Glass cannon — Body/Str capped at 4. |
| **Halfling** | 1/5 | 2/7 | 3/7 | 1/4 | 1/6 | 2/6 | 1/6 | 3/6 | 2/9 | 6 | Highest Luck cap in game (2/9). Low Str ceiling. Strong Cha floor for Face builds. |
| **Goblin** | 1/5 | 2/8 | 3/7 | 1/5 | 1/5 | 3/7 | 1/6 | 1/5 | 1/6 | 6 | Best Agility cap in game. Ware costs +10% Bio-Sync. Fast and sharp, no social/logic footing. |
| **Ork** | 4/8 | 1/6 | 1/5 | 3/8 | 1/5 | 1/5 | 3/9 | 1/5 | 1/5 | 6 | Highest Willpower cap (3/9). Low-light vision. Poison/radiation resistance scales with Body + Willpower. |
| **Oni** | 3/6 | 2/7 | 2/6 | 1/6 | 1/6 | 2/6 | 3/7 | 1/4 | 1/6 | 6 | Bright skin = stealth penalized (partially mitigated by gear). Near-zero Cha ceiling. |
| **Troll** | 3/9 | 1/5 | 2/5 | 4/9 | 1/4 | 1/4 | 2/6 | 1/5 | 1/5 | 6 | +5 natural armor (soak). Thermographic vision. Near-zero Logic/Intuition caps. |
| **Minotaur** | 4/10 | 1/4 | 1/4 | 5/11 | 1/4 | 1/4 | 3/6 | 1/3 | 1/5 | 6 | Highest Str cap in game (5/11). No Body/Str-enhancing ware. Mental ware permitted. |

**Bio-Sync starting values:** 7 — Elf, Dark Elf · 6 — all others · 5 — Dwarf  
**Bio-Sync penalty:** Surge and Goblin each incur +10% Bio-Sync consumption on all cyberware/bioware installation.

---

## 6. Character Creation

### Stat Generation — Point Buy

All characters use a fixed Karma pool distributed freely across stats within racial floor/cap bounds at creation. Karma is a creation-only currency — it is not earned or spent after character creation.

- Exact Karma pool size and per-point cost: TBD during Plan 02 design
- Racial floors represent the minimum a new character starts with in each stat
- Racial caps represent the natural maximum without cyberware or magical augmentation

### Skills — Level-Based

Skills are gained through leveling, not Karma. Characters have their entire class skillset (at level 1 proficiency) by level 8. Additional skill enhancement is purchased through in-world training.

### Creation Flow
1. Choose faction (Shadow / Corp)
2. Choose race + subrace
3. Choose class path (determines progression from level 1; base class Street Scum / Wage Slave until level 8)
4. Distribute Karma across stats (point buy within racial floor/cap)
5. Choose mentor spirit (awakened classes only)
6. Name character

---

## 7. Classes

16 classes across 4 lines. **Level cap: 50.** Full class skillset learned (at level 1 proficiency) by level 8. Job changes occur at fixed levels (TBD). Job change mechanic (specialization branch / class upgrade / reclass / prestige path) TBD — under active brainstorming. Tier 2/3 class names to be finalized during Plan 02 design.

### Combat Line
| Class | Specialty | Notes |
|-------|-----------|-------|
| Street Samurai | Guns + melee hybrid | Versatile combat; highest general damage ceiling |
| Razorboy / Razorgirl | Bladed weapons specialist | Dual-wield capable; highest single-target melee damage |
| Bounty Hunter | Tracking + combat | Locate flagged targets across zones; bounty board integration |
| Mercenary | Heavy weapons + defense | Tank/DPS hybrid; access to restricted military hardware |

### Shadow Line
| Class | Specialty | Notes |
|-------|-----------|-------|
| Face | Social manipulation | Negotiation, disguise, NPC disposition bonuses |
| Infiltrator | Stealth + assassination | Dual-wield capable; ambush bonuses |
| Rigger | Drone control | Remote combat via drones; zone scouting |
| Smuggler | Logistics + evasion | Contraband access; escape mechanics |

### Matrix Line
| Class | Specialty | Notes |
|-------|-----------|-------|
| Decker | Gear-dependent hacking | Highest matrix ceiling; wealth-gated by cyberdeck quality |
| Technomancer | Innate Resonance hacking | Lower peak than Decker; drain-limited; no gear dependency |

### Awakened Line
| Class | Specialty | Notes |
|-------|-----------|-------|
| Mage (Hermetic) | Formulaic offensive/utility magic | Hermetic tradition; logic-driven |
| Shaman | Spirit-bound magic | Shamanic tradition; mentor spirit synergy bonuses |
| Street Doc | Healing + pharmaceuticals | Two paths chosen at creation: **Magic-based** (partial awakened, lighter drain system, treats spirits, magical triage aura passive, spirit attunement buff) or **Tech-based** (pharmaceutical/biotech, no drain, resource-limited, combat stims, suppressor, cyberware installer, cannot treat spirits). Both paths share: full physical healing, mental/drain damage treatment, death sickness treatment, combat revival via Luck action. |
| Weapons Adept | Internalized physical magic | Adept tradition; bridges physical and magical combat |

### Combat Balance
- All classes have access to basic weapons (holdout pistols, knives, stun batons) — no class is helpless
- Combat line has the highest damage ceiling and widest weapon access
- Awakened and Matrix classes are not primary combatants but are never liabilities
- Decker and Technomancer deal equivalent regular combat damage to each other; Decker has higher matrix action effectiveness at peak gear

---

## 8. PvP & Security Zone System

| Security Rating | PvP Enabled | NPC Aggression | Description |
|----------------|-------------|----------------|-------------|
| AAA | No | None | Corporate enclaves, strictly patrolled |
| AA / A | No | Low | Business districts, middle city |
| B / C | No | Moderate | Residential sprawl, fringe districts |
| D | Yes | High | Barrens, gang turf, industrial ruins |
| Z (No-sec) | Yes | Very High | Wastes, forbidden zones, corp black sites |
| Mission | Yes (always) | Varies | Instanced runs — always unsafe |

- PvP protection ends at level 8 — no level-based protection after that point
- Clan/gang/division friendly-fire configurable per organization settings
- Full loot rules on PvP death in D/Z zones — specific drop percentages TBD during implementation

---

## 9. Combat System

### Engine
- Turn-based, server-side tick loop (~1 tick/second)
- Hit rate, dodge rate, and damage calculated from stats + equipment + cyberware modifiers
- Combat log rendered as scrolling text in the terminal client

### Death & Recovery
- **Death sickness:** Stat penalty applied on respawn; fades over time
- **Mitigated by:**
  - Triage token (consumable) — summons NPC rescue team, delivers character to nearest medical facility, removes death sickness
  - Street Doc player heal — primary organic cure; makes Street Docs valuable party members
- Equipment drop rules on PvP death in D/Z zones — percentages TBD

### Bounty Hunter Mechanics
- Track flagged targets across zones using Tracking skill
- Bounty board: players post nuyen contracts on other players; active in D/Z zones only

---

## 10. Matrix System

### Open World (all zones)
Matrix abilities are utility-only outside cybercombat rooms:
- Hack terminals → retrieve information, loot data, expose NPC locations
- Disable alarms → temporarily reduce enemy encounter rate in a zone
- Breach locked doors → open new room paths for the party
- Spoof credsticks → minor economy interactions
- Ghost presence → reduce corp NPC aggression in A/B zones temporarily

### Cybercombat (restricted)
- Available only in designated PvP rooms and class-specific missions
- Biofeedback as damage type — resisted by Willpower/Logic rather than Body/Armor
- Deckers use loaded exploit programs; Technomancers use innate complex forms

### Decker vs Technomancer
| | Decker | Technomancer |
|--|--------|-------------|
| Source | Hardware (cyberdeck) | Innate Resonance |
| Limit | Gear quality + nuyen | Resonance stat + drain |
| Matrix ceiling | Higher (wealth-gated) | Slightly lower |
| Regular combat | Equivalent | Equivalent |
| Unique ability | Loadable exploit programs | Complex forms (living programs) |

### Matrix Room Presence
- Rooms flagged with matrix nodes are hackable
- High-sec zones have ICE — failed hacks trigger NPC response
- No-sec zones have no ICE but may contain rival deckers

---

## 11. Magic System

### Magical Traditions
| Tradition | Style | Classes |
|-----------|-------|---------|
| Hermetic | Formulaic, logic-driven | Mage |
| Shamanic | Spirit-bound, intuitive | Shaman |
| Adept | Internalized, physical | Weapons Adept |
| Street | Improvised, hybrid | Street Doc (partial) |

### Drain
Casting costs Magic stat or Essence. Overcast = drain damage, resisted by Willpower. Street Docs use biotech skill rather than pure Magic for healing abilities.

### Mentor Spirits
Chosen at creation by awakened characters. Each grants one unique buff ability, a minor passive effect, and a minor penalty for balance. Non-awakened characters do not choose a mentor spirit.

| Spirit | Unique Buff | Passive | Role |
|--------|-------------|---------|------|
| **Bear** | Enhance Physical — boosts melee/physical damage for self or one teammate | Minor physical damage resist | Damage amplifier |
| **Gator** | First Strike — user always acts first; can gift initiative to a teammate | Bonus vs. surprised enemies | Initiative control |
| **Cat** | Ghoststep — agility/evasion buff for self and/or teammates | Minor stealth bonus | Dodge/mobility |
| **Eagle** | Keen Eye — perception bonus; reveals enemy weaknesses to exploit in combat | Reduced ambush vulnerability | Scouting/debuff setup |
| **Wolf** | Pack Bond — weak AoE team buff OR strong single-target "alpha" designation buff | Minor loyalty-based NPC disposition bonus | Flexible support |
| **Rat** | Fade — stealth/subterfuge to avoid being targeted by enemies | Bonus to escape/disengage | Self-preservation |
| **Valkyrie** | Last Rites — first team casualty per combat gets one free revive to low health, no death sickness | Minor resist to instant-kill effects | Resurrection anchor |
| **Chaos** | Wild Surge — random buffs/debuffs distributed to both sides at combat start | None | Wildcard/gambler |

Wild Surge (Chaos) fires automatically at combat start. Buff/debuff pool, weighting, and percentages to be tuned during implementation.

### Magical Preparations (replaces blessing system)
- Hermetic Mages and Shamans craft preparations — spell effects stored in physical foci (fetishes, vials, data chips per tradition)
- Distributed to teammates as consumables
- Preparation strength tied to crafter's Magic stat and drain accepted at creation time
- Preparations decay over time — not permanent; creates ongoing crafting economy
- Street Docs craft pharmaceutical equivalents: stimulants, boosters, trauma patches, combat drugs

---

## 12. Economy, Crafting & Loot

### Currency
Nuyen (¥)

### Item Rarity Tiers
| Tier | Color | Primary Source |
|------|-------|---------------|
| Common | White | Shops, basic mob drops |
| Uncommon | Green | Standard mob drops |
| Rare | Blue | Named mobs, mission rewards |
| Legendary | Orange | World bosses, rare drop tables |
| Unique | Red | One-of-a-kind; event-only or crafted |

### Drop System (`loot/` domain)
- Per-mob weighted drop tables with rarity rolls
- World boss exclusive drops — Legendary/Unique tier only
- Named mob drops (mini-bosses in D/Z zones) — guaranteed Rare+ on first weekly kill per character
- Event-only items cycle seasonally; never re-enter standard loot tables after event ends

### Crafting
- **Token shard system:** Shards combine into tokens; used to rename or "brill" items into enhanced variants (carried from RoK)
- **Pharmaceutical crafting:** Street Docs only — stimulants, painkillers, trauma patches, combat drugs
- **Preparation crafting:** Awakened classes — spell-effect consumables distributed to teammates
- **Scroll crafting:** Enchant/bless/soulbind scrolls purchasable and craftable by awakened characters
- **Decker program crafting:** Exploit loadouts, ICE-breakers, utility programs

### Enchanting & Soulbinding
- **Enchanting:** Awakened characters enhance weapons/armor with magical properties
- **Soulbinding:** Item binds to first equipped character; unbinding costs significant nuyen
- Soulbinding limits item trading and reduces duplication exploits

### Markets
- **Auction house:** Corp-aligned city; regulated player-to-player trading
- **Street market:** Shadow-aligned city; lower fees, less regulation, minor NPC scam risk

---

## 13. Social Systems

### Gangs (Shadow faction)
- Player-formed organizations for Shadow faction characters
- Gang chat channel, gang hall (purchasable), shared gang bank (nuyen + items)
- PK / Anti-PK alignment configurable
- Gang vs Gang warfare in D/Z zones and contested turf

### Divisions (Corp faction)
- Player-formed organizations for Corp faction characters
- Division comms channel, division office (purchasable), shared division fund
- Same structural mechanics as gangs; different flavor and NPC interactions

### Bounty Board
- Players post nuyen contracts on other players
- Active in D/Z zones only
- Bounty Hunters receive tracking bonuses against contracted targets

### Chat Channels
- Global, zone, local, gang/division, party
- Spam prevention

---

## 14. Events

### Recurring
- **Arena events** (Friday Night equivalent) — staff-warped mass PvP, free-for-all or team format, prize items
- **World bosses** — random zone spawn, zone-wide announcement, Legendary/Unique loot, group encounter
- **Tough Guy Championship** — level-cap tournament bracket

### Seasonal
- Time-limited missions with unique narrative
- Event-only Unique item drops that never re-enter loot tables after event ends

### Staff Tools
- Admin warp, NPC spawn, event trigger, world boss summon
- Builder tools for room/zone/NPC creation (for world expansion by contributors)

---

## 15. Testing Approach

Tests written after working features are built.

- **Unit tests:** Per domain service — combat calculations, loot rolls, matrix ability resolution, stat generation
- **Integration tests:** Critical paths — character creation, death/respawn cycle, item soulbinding, WebSocket session management
- **Load tests:** Concurrent player simulation via Artillery or k6
- **Manual playtesting:** Combat pacing, zone balance, mentor spirit tuning, class balance

---

## 16. Open Questions (Deferred to Implementation Planning)

**Resolved:**
- ~~Level cap~~ → **50**
- ~~Racial stat floors, ceilings, and class restrictions~~ → **Finalized (see §5). No class restrictions.**
- ~~Karma creation method vs roll method~~ → **Point buy only. Karma = creation currency.**

**Active — under brainstorming:**
- Job change mechanic (specialization branch / class upgrade / reclass / prestige path)
- Fixed levels at which job changes occur
- Tier 2 and Tier 3 class names for all 16 class paths
- Exact Karma pool size at character creation and per-stat-point cost

**Deferred:**
- Full loot drop percentage on PvP death in D/Z zones
- Wild Surge (Chaos mentor spirit) buff/debuff pool and weighting
- World map layout, city names, zone names, faction corp/gang names
- Cyberware system depth (stat augmentation vs. full implant economy)
