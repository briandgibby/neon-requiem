# Neon Requiem — Domain Glossary

Terms defined here are the canonical vocabulary for this codebase. Use these names in code, comments, plans, and design discussions. When a new concept is named during a design conversation, add it here.

---

## Character Classes

### Rigger
A matrix-line character class specializing in drone and vehicle control. Riggers operate remotely in physical space without jacking into a full matrix host. They are the only class permitted to own vehicles. Their primary wireless capabilities are drone deployment and vehicle operation; broader tech actions (e.g. hacking maglocks) are within reach but secondary to drone/vehicle focus.

### Decker
A matrix-line character class specializing in host infiltration. Deckers jack into the full matrix to hack nodes, crack ICE, and breach corporate systems. In physical space they retain wireless capability for ambient tech actions (maglocks, low-alert alarms) without a full dive.

### Technomancer
A matrix-line character class with innate resonance abilities — no cyberdeck required. Technomancers can jack in using natural resonance and perform wireless tech actions in physical space, identical in scope to deckers.

---

## Execution Modes (Command Dispatcher)

Commands declare one of four execution modes. The dispatcher enforces the guard before calling the handler.

| Mode | Guard | Allowed Classes |
|------|-------|----------------|
| `physical` | Must NOT be jacked in | Any |
| `matrix` | Must be jacked in | Any (with deck/resonance) |
| `any` | No restriction | Any |
| `wireless` | Must NOT be jacked in | `decker`, `technomancer`, `rigger` |

The class check for `wireless` mode uses a `CharacterClassComponent` cached in ECS at entity creation — no DB hit at dispatch time.

---

## Vehicles

### Vehicle
A rigger-exclusive inventory item occupying a dedicated vehicle slot (separate from general inventory). Vehicles have their own HP and armor pools. While active, a vehicle functions as a mobile room: all occupants travel together under **compulsory follow**.

When a vehicle's HP reaches zero, it is **disabled**: the vehicle slot item gains a `disabled` flag and requires repair before it can be deployed again. Occupants are ejected into the current room on foot with no additional damage (they lose the vehicle's protection, not HP directly).

Only riggers may have a vehicle slot. Non-riggers cannot equip or deploy vehicles.

### Compulsory Follow
A movement mechanic where all characters inside an active vehicle are transported together when the rigger moves. Unlike the voluntary party follow command, compulsory follow cannot be opted out of while inside the vehicle. Characters may exit the vehicle to leave the compulsory follow group.

### Disabled Vehicle
State a vehicle enters when its HP pool is depleted. The vehicle item in the rigger's slot gains a `disabled` flag and cannot be deployed. Repair restores HP and clears the flag. Design intent: disabled vehicles become a field-repair objective for the rigger, creating tactical pressure without permanently destroying the asset.

---

## Matrix Concepts

### Wireless Mode
Tech actions performed in physical space without jacking into a full matrix host. Available to deckers, technomancers, and riggers. Examples: cracking a maglock, suppressing a low-alert alarm, remote drone deployment. High-alert systems (RED alert corporate hosts) require a full matrix dive and are not available in wireless mode.

### Physical Presence Requirement
A flag on a matrix node (`requiresPhysicalPresence: true`) indicating that jacking in requires the decker to be physically on-site — inside the instance rooms associated with the node. Remote wireless access to these nodes is blocked regardless of class.

---

## Player Interface

### Hotkey
A player-defined mapping from a short trigger string or UI selection to a full command string, stored per-character. Hotkeys are a convenience layer expanded to canonical command text before reaching the command parser — they are not server-side command aliases. The command dispatcher only ever receives normalized command text; hotkey expansion happens upstream (client or a pre-dispatch layer). This deliberately keeps the command surface clean: sloppy or abbreviated input is a player's own configured shortcut, not a parsing concern for the dispatcher.

### Hotkey Picker
A UI component that lets players configure hotkeys without typing. Presents available commands as dropdown menus populated from the `CommandRegistry`. Each command entry exposes a `label` (display name), `description` (tooltip), `usage` hint, and `mode` — the picker uses `mode` to filter the visible command list to only those valid in the player's current state (physical vs. matrix). Design intent: the game must be fully playable by someone who cannot type, using only the hotkey picker and mapped inputs.

---

## Mission Concepts

### Mission Instance
A private, ephemeral set of rooms generated when a party accepts a mission. Instance rooms are owned by a `MissionInstance` record and cleaned up (ECS entities evicted, DB rooms deleted) after the instance resolves (COMPLETED or ABANDONED).

### Instance Alert Level
A `GREEN | YELLOW | RED` escalation track on a `MissionInstance`. Alert level only ever escalates — never de-escalates within a single instance run. Affects mob reinforcement behavior and matrix node security.
