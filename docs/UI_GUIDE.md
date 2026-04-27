# Neon Requiem — UI Guide

**Goal:** This document details the architectural decisions, aesthetic guidelines, and technical implementation of the Neon Requiem frontend client.

---

## 1. Aesthetic: "The High-Fidelity Deck"

The UI is designed to feel like a custom-built neural deck interface used by Shadowrunners. It prioritizes information density while maintaining a gritty, cinematic atmosphere.

### Core Visual Rules
- **Typography:** Monospaced fonts only (`Courier New`, `ui-monospace`). All-caps for headers.
- **Color Palette:**
    - **Base:** `#020402` (Deep Black)
    - **Primary:** `#00ff41` (Matrix Green)
    - **Accent (Shadow):** Pink-500
    - **Accent (Corp):** Blue-400
    - **Warnings:** Yellow-500 or Orange-500
- **Effects:** 
    - **CRT Scanlines:** Global overlay with subtle flicker.
    - **Glow:** Text and borders use subtle outer glows (`text-shadow`, `box-shadow`).
    - **Grayscale Imagery:** World-view art remains grayscale/low-opacity until interacted with.

---

## 2. Technical Stack

- **Framework:** React 19 (Functional components, Hooks).
- **Styling:** Tailwind CSS 4 (Utility-first with custom `neon-panel` and `corner-accent` classes).
- **Icons:** Lucide-React.
- **Terminal:** `xterm.js` for the primary output feed.
- **Socket:** `socket.io-client` for real-time state synchronization.

---

## 3. UI Layout

The interface follows a strict three-column modular grid:

### A. Navigation Console (Left)
- **Location Module:** Displays current room name and slug.
- **Exit Grid:** 4x4 directional pad (N, S, E, W, Up, Down). Buttons are disabled if the exit does not exist.

### B. Command Center (Center)
- **World View Panel:** Top 60% of the screen. Displays high-resolution cinematic art representing the current zone/room.
- **Terminal Panel:** Bottom 40% of the screen. Primary interaction feed where room descriptions, combat logs, and system messages appear.

### C. Bio-Monitor (Right)
- **Vitals:** HP bar (Bio-Integrity), AP pips (Action Pool), and Armor rating (Soak).
- **Portrait:** Dynamic character art based on race/class.
- **Identity:** Fixed panel showing character name, level, faction, and archetype.

---

## 4. Key Components

### `Terminal.tsx`
A wrapper around `xterm.js`. It uses `useImperativeHandle` to expose `write`, `writeln`, and `clear` methods to parent components. It handles user input buffers and sends cleaned commands back to the `GameView`.

### `AuthView.tsx`
A standalone full-screen interface for registration and login. It uses a "Neural Interface Portal" aesthetic.

---

## 5. Socket Integration

The client uses the `useSocket` hook to maintain a persistent link.
- **`command`**: Emitted when the user types in the terminal.
- **`message`**: Received from the server to print colored text in the terminal.
- **`room_data`**: Updates the location sidebar and prints room descriptions.
- **`character_update`**: Real-time sync for HP, AP, and stats.
