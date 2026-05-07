# Neon Requiem — Plan 10: Frontend Client

**Goal:** Create a visually appealing, terminal-style React application using `xterm.js` to enable playtesting of auth, character creation, and world movement/combat.

**Status:** Partially implemented — Vite/React client exists with auth, character selection/creation, xterm.js terminal, Socket.IO connection, main HUD, room display, exits, and POI navigation. This plan is no longer a draft. Missing pieces include multiplayer presence UI, local chat, live combat/matrix command integration, configurable API/socket URLs, stronger payload types, client tests, and a repeatable build on the intended Node 22 environment.

**Verified 2026-04-28:** frontend build in WSL fails before source bundling due missing Rolldown optional native dependency `@rolldown/binding-linux-x64-gnu`; treat as dependency/environment issue unless reproduced after a clean Node 22 install.

---

## Technical Stack
- **Framework:** React + Vite
- **Terminal:** `xterm.js` + `xterm-addon-fit`
- **Styling:** Tailwind CSS (for layout and sidebars)
- **Communication:** `socket.io-client`
- **State Management:** React Context or Zustand

---

## File Map (Proposed)

```
client/
├── public/
├── src/
│   ├── components/
│   │   ├── Terminal.tsx       # xterm.js wrapper
│   │   ├── Sidebar.tsx        # HP, AP, Stats display
│   │   └── Input.tsx          # Command input line
│   ├── hooks/
│   │   ├── useSocket.ts       # Socket.IO connection logic
│   │   └── useGameLogic.ts    # Parser for terminal commands
│   ├── views/
│   │   ├── LoginView.tsx
│   │   ├── CharacterView.tsx  # Character selection/creation
│   │   └── GameView.tsx       # The main HUD
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── tailwind.config.js
└── vite.config.ts
```

---

## Task 1: Scaffolding & Setup
- [x] Initialize Vite + React project in `/client`.
- [x] Install dependencies: `xterm`, `xterm-addon-fit`, `socket.io-client`, `tailwindcss`, `lucide-react`.
- [x] Configure Tailwind/CSS for a cyberpunk "Neon" aesthetic (Black, Neon Green, Hot Pink).

---

## Task 2: Terminal Component (`xterm.js`)
- [x] Create a `Terminal` component that wraps `xterm.js`.
- [x] Implement a "Fit" addon to ensure it fills its container.
- [~] Create helper methods to print colored text. Current terminal output supports ANSI-style colored writes; richer helper APIs can be added later if needed.

---

## Task 3: Socket.IO Integration
- [~] Set up Socket.IO connection logic in `useSocket.ts`. A full SocketContext is not currently present.
- [~] Handle authentication with stored JWT in `useAuth.ts`; reconnect/auth-expiry behavior still needs hardening.
- [~] Map socket events (`room_data`, `message`, `local_pois`, `character_update`) to terminal/HUD output. Multiplayer/chat/combat/matrix events remain incomplete.

---

## Task 4: Command Parser
- [ ] Create a simple client-side parser for basic commands:
    - `n`, `s`, `e`, `w`, etc. -> `POST /world/move` or Socket equivalent.
    - `attack <target>`, `guard`, `flee` -> `POST /combat/action`.
    - `who`, `look`, `help`.
    - Chat commands.

---

## Task 5: UI Views
- [x] **Login/Register:** Simple forms with terminal-style buttons.
- [x] **Character Creator:** Multi-step form for Faction/Race/Class selection.
- [~] **Main HUD:**
    - Center: Terminal exists.
    - Right Sidebar: Character vitals exist, but some fields are placeholders/static.
    - Left Sidebar: Map/POI/exits panel exists; room occupants and chat are not implemented yet.

---

## Task 6: Polish & Aesthetics
- [ ] Add scanline/CRT effects via CSS.
- [ ] Implement "Typewriter" effect for atmospheric room descriptions.
- [ ] Sound effects (optional): Mechanical keyboard clicks, terminal boot sounds.

---

## Completion Checklist
- [x] Client can connect to Backend in the current prototype.
- [x] User can log in/register and create a character.
- [x] User can move through rooms and see descriptions in the terminal.
- [ ] Combat feedback is rendered correctly.
- [ ] Room occupants and local chat are rendered.
- [ ] API/socket URLs are environment-configured instead of hardcoded.
- [ ] Frontend build is verified on Node 22 after a clean dependency install.
