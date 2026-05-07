import { WorldService } from '../domains/world/world.service';
import { SocketHub } from './socket-hub';
import { Direction } from '../shared/types';

export interface CommandOutput {
  emit(event: string, data: any): void;
  data: {
    characterId?: string;
    accountId?: string;
  };
}

export class CommandDispatcher {
  constructor(
    private readonly worldService: WorldService,
    private readonly socketHub: SocketHub,
  ) {}

  async dispatch(output: CommandOutput, commandText: string): Promise<void> {
    const characterId = output.data.characterId;
    const accountId = output.data.accountId;

    if (!characterId || !accountId) return;

    const rawCommand = commandText.trim();
    if (!rawCommand) return;

    const firstSpaceIndex = rawCommand.indexOf(' ');
    const action = firstSpaceIndex === -1 ? rawCommand.toLowerCase() : rawCommand.slice(0, firstSpaceIndex).toLowerCase();
    const argsString = firstSpaceIndex === -1 ? '' : rawCommand.slice(firstSpaceIndex + 1).trim();
    const args = argsString ? argsString.split(/\s+/) : [];

    const respond = (event: string, data: any) => output.emit(event, data);
    const message = (text: string, type: string = 'info') => respond('message', { text, type });

    try {
      if (action === 'help') {
        message('Commands: look, who, say <message>, tell <name> <message>, n/s/e/w/u/d, north/south/east/west/up/down, navigate <poi>, help');
      } else if (action === 'look') {
        const selected = this.socketHub.getSelectedClient(output as any);
        if (!selected) throw new Error('No character selected.');
        const room = await this.worldService.getRoom(selected.roomId);
        respond('room_data', room);
        respond('room_occupants', this.socketHub.getRoomOccupants(room.id));
      } else if (action === 'who') {
        const selected = this.socketHub.getSelectedClient(output as any);
        if (!selected) throw new Error('No character selected.');
        const occupants = this.socketHub.getRoomOccupants(selected.roomId);
        const names = occupants.map((occupant) => occupant.name).join(', ');
        message(names ? `Here: ${names}` : 'No one else is visible here.');
      } else if (action === 'say') {
        const selected = this.socketHub.getSelectedClient(output as any);
        if (!selected) throw new Error('No character selected.');
        if (!argsString) {
          message('Usage: say <message>');
          return;
        }
        this.socketHub.emitToRoom(selected.roomId, 'chat_message', {
          from: selected.characterName,
          text: argsString,
          scope: 'room',
        });
      } else if (action === 'tell') {
        const selected = this.socketHub.getSelectedClient(output as any);
        if (!selected) throw new Error('No character selected.');
        const targetName = args[0];
        const chatContent = args.slice(1).join(' ').trim();
        if (!targetName || !chatContent) {
          message('Usage: tell <name> <message>');
          return;
        }
        const targetSocketId = this.socketHub.findSocketForCharacter(targetName);
        if (!targetSocketId) {
          message(`${targetName} is not online.`, 'error');
          return;
        }
        this.socketHub.sendToSocket(targetSocketId, 'chat_message', {
          from: selected.characterName,
          text: chatContent,
          scope: 'tell',
        });
        respond('chat_message', {
          from: `to ${targetName}`,
          text: chatContent,
          scope: 'tell',
        });
      } else if (['n', 's', 'e', 'w', 'u', 'd', 'north', 'south', 'east', 'west', 'up', 'down'].includes(action)) {
        const directionMap: Record<string, Direction> = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' };
        const direction = directionMap[action] || (action as Direction);

        const result = await this.worldService.moveCharacter(characterId, accountId, direction);
        if (result.success && result.room) {
          respond('room_data', result.room);
          const pois = await this.worldService.getPOIs(result.room.zoneId);
          respond('local_pois', pois);
        } else {
          message(result.error || 'You cannot go that way.', 'error');
        }
      } else if (action === 'navigate') {
        const targetSlug = args[0];
        if (!targetSlug) {
          message('Usage: navigate <poi>');
          return;
        }

        const results = await this.worldService.navigate(characterId, accountId, targetSlug);

        for (const result of results) {
          if (result.success && result.room) {
            respond('room_data', result.room);
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            message(result.error || 'Navigation failed.', 'error');
            break;
          }
        }

        if (results.length > 0 && results[results.length - 1].success) {
          const finalRoom = results[results.length - 1].room!;
          const pois = await this.worldService.getPOIs(finalRoom.zoneId);
          respond('local_pois', pois);
        }
      } else {
        message(`Unknown command: ${action}`);
      }
    } catch (err: any) {
      message(err.message || 'An error occurred.', 'error');
    }
  }
}
