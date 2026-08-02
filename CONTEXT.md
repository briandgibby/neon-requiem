# Neon Requiem

Neon Requiem is a persistent multiplayer world whose physical, Matrix, and mission activity must converge on shared domain state.

## Language

**Instance Alert Level**:
The canonical GREEN, YELLOW, or RED security state shared by every room and Matrix node belonging to one active Mission Instance.
_Avoid_: Room alert level, node alarm state

**Instance Alert Source**:
The room associated with the most recent explicit live trigger at the current Instance Alert Level. Background reconciliation may fill a missing source but never replace an existing one.
_Avoid_: First alert room, retry source
