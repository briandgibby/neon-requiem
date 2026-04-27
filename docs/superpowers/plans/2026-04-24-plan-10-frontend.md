# Neon Requiem — Plan 10: Frontend Client

**Goal:** Create a visually appealing, terminal-style React application using `xterm.js` to enable playtesting of auth, character creation, and world movement/combat.

**Status:** Draft

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
- [ ] Initialize Vite + React project in `/client`.
- [ ] Install dependencies: `xterm`, `xterm-addon-fit`, `socket.io-client`, `tailwindcss`, `lucide-react`.
- [ ] Configure Tailwind for a cyberpunk "Neon" aesthetic (Black, Neon Green, Hot Pink).

---

## Task 2: Terminal Component (`xterm.js`)
- [ ] Create a `Terminal` component that wraps `xterm.js`.
- [ ] Implement a "Fit" addon to ensure it fills its container.
- [ ] Create helper methods to print colored text (e.g., `printInfo`, `printError`, `printCombat`).

---

## Task 3: Socket.IO Integration
- [ ] Set up a `SocketContext` to manage the connection to the backend.
- [ ] Handle automatic re-authentication using stored JWT.
- [ ] Map socket events (`room_data`, `combat_result`, `chat_message`) to terminal output.

---

## Task 4: Command Parser
- [ ] Create a simple client-side parser for basic commands:
    - `n`, `s`, `e`, `w`, etc. -> `POST /world/move` or Socket equivalent.
    - `attack <target>`, `guard`, `flee` -> `POST /combat/action`.
    - `who`, `look`, `help`.
    - Chat commands.

---

## Task 5: UI Views
- [ ] **Login/Register:** Simple forms with terminal-style buttons.
- [ ] **Character Creator:** Multi-step form for Faction/Race/Class selection.
- [ ] **Main HUD:**
    - Center: Terminal.
    - Right Sidebar: Character vitals (HP bar, AP pips, Level).
    - Left Sidebar: Map (text-based or small grid) + Room Info.

---

## Task 6: Polish & Aesthetics
- [ ] Add scanline/CRT effects via CSS.
- [ ] Implement "Typewriter" effect for atmospheric room descriptions.
- [ ] Sound effects (optional): Mechanical keyboard clicks, terminal boot sounds.

---

## Completion Checklist
- [ ] Client can connect to Backend.
- [ ] User can log in and create a character.
- [ ] User can move through rooms and see descriptions in the terminal.
- [ ] Combat feedback is rendered correctly.
