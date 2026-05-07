# CLI Memory: Best Practices & Lessons Learned

## Shell & Environment
- **PowerShell Syntax:** This environment uses PowerShell. When deleting multiple files, use `;` to separate commands (e.g., `Remove-Item file1; Remove-Item file2`) rather than space-separated arguments which can trigger positional parameter errors.
- **Path Handling:** Always use relative paths from the project root for consistency.

## Architecture: The Heartbeat
- **Structured Registry over Procedural Loops:** Prefer a subscriber-based `Heartbeat` model for game loops. It provides better **locality** for domain logic (e.g., Combat, Patrols) and allows for variable execution frequencies.
- **Interface Leverage:** Use a `Tickable` interface to enforce a common contract for anything that needs to react to time.

## Scaling Strategy
- **Zonal Isolation:** Plan for distributing game areas across processes to prevent localized lag from affecting the whole world.
- **Precision Timing:** `setTimeout` is prone to drift; for high-scale, research `setImmediate` with `process.hrtime()` in a dedicated worker thread.
- **State Synchronization:** Moving from in-memory maps to a shared cache (Redis) is the primary path to horizontal scaling.
