# Scaling Research: Future-Proofing the Heartbeat

As Neon Requiem grows, the single-threaded Node.js event loop will eventually become a bottleneck for game timing. Below are the key areas for future research and implementation.

## 1. Zonal Architecture (Process Isolation)
Currently, a single heartbeat processes the entire world.
- **Research:** Distributing "Areas" or "Zones" across multiple worker threads or separate processes.
- **Goal:** If "The Matrix" is under heavy load, it shouldn't lag "The Street."

## 2. Horizontal Scaling & Global State
Node.js processes cannot easily share memory.
- **Research:** Moving active game state (Presence, Combat Sessions) into a high-performance cache like Redis.
- **Challenge:** Maintaining "Tick Synchronization" across multiple server instances.

## 3. High-Performance Timing
`setTimeout` and `setInterval` are not high-precision timers and can drift under load.
- **Research:** Using `setImmediate` with a high-resolution time check (`process.hrtime()`) for a "busy-wait" style loop in a dedicated worker thread to ensure microsecond-level accuracy.

## 4. Delta-Time Processing
Switching from "Tick Number" to "Delta Time" (time elapsed since last frame).
- **Research:** How to handle physics or damage over time consistently regardless of minor fluctuations in tick rate.

## 5. ECS (Entity Component System)
As the number of "Tickables" grows to thousands (NPCs, dynamic items, effects).
- **Research:** Adopting an ECS pattern (like `bitecs`) where logic is separated from data, allowing the engine to iterate over arrays of data very efficiently.
