import { RoomRecord } from './world.types';
import { Direction } from '../../shared/types';

export interface PathStep {
  roomId: string;
  direction: Direction;
}

export class NavigationUtils {
  /**
   * Finds the shortest path between two rooms using Breadth-First Search (BFS).
   * Returns a list of steps (direction + destination) to reach the target.
   */
  static findPath(
    startRoomId: string,
    targetRoomId: string,
    allRooms: RoomRecord[]
  ): PathStep[] | null {
    if (startRoomId === targetRoomId) return [];

    const roomMap = new Map<string, RoomRecord>(allRooms.map(r => [r.id, r]));
    const slugToRoom = new Map<string, RoomRecord>(allRooms.map(r => [r.slug, r]));
    
    const queue: string[] = [startRoomId];
    const visited = new Set<string>([startRoomId]);
    const parentMap = new Map<string, { parentId: string; direction: Direction }>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (currentId === targetRoomId) return this.reconstructPath(startRoomId, targetRoomId, parentMap);

      const currentRoom = roomMap.get(currentId);
      if (!currentRoom || !currentRoom.exits) continue;

      const exits = currentRoom.exits as Record<Direction, string>;
      for (const [direction, targetSlug] of Object.entries(exits)) {
        const neighbor = slugToRoom.get(targetSlug);
        if (neighbor && !visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          parentMap.set(neighbor.id, { parentId: currentId, direction: direction as Direction });
          queue.push(neighbor.id);
        }
      }
    }

    return null;
  }

  private static reconstructPath(
    startRoomId: string,
    targetRoomId: string,
    parentMap: Map<string, { parentId: string; direction: Direction }>
  ): PathStep[] {
    const path: PathStep[] = [];
    let curr = targetRoomId;
    while (curr !== startRoomId) {
      const { parentId, direction } = parentMap.get(curr)!;
      path.unshift({ roomId: curr, direction });
      curr = parentId;
    }
    return path;
  }
}
