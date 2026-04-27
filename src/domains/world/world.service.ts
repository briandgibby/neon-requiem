import { WorldRepository } from './world.repository';
import { CharacterRepository } from '../character/character.repository';
import { RoomRecord, MovementResult } from './world.types';
import { Direction } from '../../shared/types';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { NavigationUtils } from './navigation';

export class WorldService {
  constructor(
    private readonly worldRepo: WorldRepository,
    private readonly charRepo: CharacterRepository,
  ) {}

  async getRoom(slugOrId: string): Promise<RoomRecord> {
    let room = await this.worldRepo.findRoomBySlug(slugOrId);
    if (!room) {
      room = await this.worldRepo.findRoomById(slugOrId);
    }
    if (!room) throw new NotFoundError('Room');
    return room;
  }

  async moveCharacter(characterId: string, accountId: string, direction: Direction): Promise<MovementResult> {
    const character = await this.charRepo.findByIdAndAccount(characterId, accountId);
    if (!character) throw new NotFoundError('Character');

    if (!character.currentRoomId) {
      throw new ValidationError('Character is not currently in any room');
    }

    const currentRoom = await this.worldRepo.findRoomById(character.currentRoomId);
    if (!currentRoom) throw new NotFoundError('Current room');

    const exits = currentRoom.exits as Record<Direction, string> | null;
    if (!exits || !exits[direction]) {
      return {
        success: false,
        error: `There is no exit to the ${direction}`,
      };
    }

    const nextRoomSlug = exits[direction];
    const nextRoom = await this.worldRepo.findRoomBySlug(nextRoomSlug);
    if (!nextRoom) {
      return {
        success: false,
        error: `Target room '${nextRoomSlug}' does not exist`,
      };
    }

    await this.worldRepo.updateCharacterLocation(characterId, nextRoom.id);

    return {
      success: true,
      room: nextRoom,
    };
  }

  async navigate(characterId: string, accountId: string, targetPoiSlug: string): Promise<MovementResult[]> {
    const character = await this.charRepo.findByIdAndAccount(characterId, accountId);
    if (!character) throw new NotFoundError('Character');

    const targetRoom = await this.worldRepo.findRoomBySlug(targetPoiSlug);
    if (!targetRoom) throw new NotFoundError('POI');

    // 1. Check Area Knowledge
    const zone = await this.worldRepo.findZoneById(targetRoom.zoneId);
    if (!zone || !character.areaKnowledge.includes(zone.slug)) {
      throw new ValidationError(`You do not have area knowledge of the ${zone?.name || 'target'} district.`);
    }

    // 2. Find Path
    const allRooms = await this.worldRepo.getAllRooms();
    const path = NavigationUtils.findPath(
      character.currentRoomId!,
      targetRoom.id,
      allRooms
    );

    if (!path) {
      throw new ValidationError('No path found to the target location.');
    }

    // 3. Execute Path (Simplified: return the sequence of rooms)
    // In a real MUD, we might add a delay between each room move
    const results: MovementResult[] = [];
    for (const step of path) {
      // Check for hostiles in the current room before moving to the next?
      // For now, move instantly
      const moveResult = await this.moveCharacter(characterId, accountId, step.direction);
      results.push(moveResult);
      if (!moveResult.success) break;
    }

    return results;
  }

  async cleanRoom(characterId: string, accountId: string, roomId: string): Promise<{ success: boolean; message: string }> {
    const character = await this.charRepo.findByIdWithInventory(characterId, accountId);
    if (!character) throw new NotFoundError('Character');

    const room = await this.worldRepo.findRoomById(roomId);
    if (!room) throw new NotFoundError('Room');
    if (room.isClean) return { success: true, message: 'Room is already clean.' };

    const cSquared = character.inventory.find((i: any) => i.item.slug === 'c-squared');
    const bodyBag = character.inventory.find((i: any) => i.item.slug === 'body-bag');

    if (!cSquared || !bodyBag) {
      throw new ValidationError('You need both C-Squared and a Body Bag to clean this room.');
    }

    // Consume items
    await this.charRepo.updateInventoryItem(cSquared.id, -1);
    await this.charRepo.updateInventoryItem(bodyBag.id, -1);

    await this.worldRepo.updateRoom(roomId, { isClean: true, lastCombatAt: null });

    return {
      success: true,
      message: 'You meticulously clean the room, removing all traces of the encounter.'
    };
  }

  private async consumeItem(inventoryItemId: string) {
    await this.charRepo.updateInventoryItem(inventoryItemId, -1);
  }
}
