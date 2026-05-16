import { WorldService } from '../domains/world/world.service';
import { SocketHub } from './socket-hub';
import { MatrixService } from '../domains/matrix/matrix.service';
import { Direction } from '../shared/types';
import { EcsRegistry } from './ecs/registry';
import { ComponentTypes, DeckerComponent, PlayerIdComponent } from './ecs/components';

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
    private readonly matrixService: MatrixService,
    private readonly ecsRegistry?: EcsRegistry,
  ) {}

  private isJackedIn(characterId: string): boolean {
    if (!this.ecsRegistry) return false;
    const entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (p) => p.characterId === characterId
    );
    if (!entityId) return false;
    return !!this.ecsRegistry.getComponent<DeckerComponent>(entityId, ComponentTypes.Decker);
  }

  async dispatch(output: CommandOutput, commandText: string): Promise<void> {
    const characterId = output.data.characterId;
    const accountId = output.data.accountId;

    if (!characterId || !accountId) return;

    const rawCommand = commandText.trim();
    if (!rawCommand) return;

    const firstSpaceIndex = rawCommand.indexOf(' ');
    // Handle two-word actions like "jack in" and "jack out" and "data spike"
    let action = '';
    let argsString = '';
    let args: string[] = [];

    const lowerCommand = rawCommand.toLowerCase();
    if (lowerCommand.startsWith('jack in')) {
      action = 'jackin';
      argsString = rawCommand.slice(7).trim();
      args = argsString ? argsString.split(/\s+/) : [];
    } else if (lowerCommand.startsWith('jack out')) {
      action = 'jackout';
      argsString = rawCommand.slice(8).trim();
      args = argsString ? argsString.split(/\s+/) : [];
    } else if (lowerCommand.startsWith('data spike')) {
      action = 'spike';
      argsString = rawCommand.slice(10).trim();
      args = argsString ? argsString.split(/\s+/) : [];
    } else {
      action = firstSpaceIndex === -1 ? rawCommand.toLowerCase() : rawCommand.slice(0, firstSpaceIndex).toLowerCase();
      argsString = firstSpaceIndex === -1 ? '' : rawCommand.slice(firstSpaceIndex + 1).trim();
      args = argsString ? argsString.split(/\s+/) : [];
    }

    const respond = (event: string, data: any) => output.emit(event, data);
    const message = (text: string, type: string = 'info') => respond('message', { text, type });

    try {
      if (action === 'help') {
        message('Commands: look, who, say <message>, tell <name> <message>, n/s/e/w/u/d, north/south/east/west/up/down, navigate <poi>, jack in, jack out, brute, sleaze, spike <ice-id>, help');
      } else if (action === 'look') {
        const selected = this.socketHub.getSelectedClient(output as any);
        if (!selected) throw new Error('No character selected.');
        
        // Matrix look
        const activeNode = await this.matrixService.getActiveNode(characterId, accountId);
        if (activeNode) {
          respond('matrix_data', activeNode);
          return;
        }

        const room = await this.worldService.getRoom(selected.roomId) as any;
        room.occupants = this.socketHub.getRoomOccupants(room.id).filter(o => o.characterId !== characterId);
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
        if (this.isJackedIn(characterId)) {
          message('Your body is unresponsive — you are deep in the matrix.', 'error');
          return;
        }
        const directionMap: Record<string, Direction> = { n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down' };
        const direction = directionMap[action] || (action as Direction);

        const result = await this.worldService.moveCharacter(characterId, accountId, direction);
        if (result.success && result.room) {
          const room = result.room as any;
          room.occupants = this.socketHub.getRoomOccupants(room.id).filter(o => o.characterId !== characterId);
          respond('room_data', room);
          const pois = await this.worldService.getPOIs(result.room.zoneId);
          respond('local_pois', pois);
        } else {
          message(result.error || 'You cannot go that way.', 'error');
        }
      } else if (action === 'navigate') {
        if (this.isJackedIn(characterId)) {
          message('Your body is unresponsive — you are deep in the matrix.', 'error');
          return;
        }
        const targetSlug = args[0];
        if (!targetSlug) {
          message('Usage: navigate <poi>');
          return;
        }

        const results = await this.worldService.navigate(characterId, accountId, targetSlug);

        for (const result of results) {
          if (result.success && result.room) {
            const room = result.room as any;
            room.occupants = this.socketHub.getRoomOccupants(room.id).filter(o => o.characterId !== characterId);
            respond('room_data', room);
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
      } else if (action === 'jackin') {
        const selected = this.socketHub.getSelectedClient(output as any);
        if (!selected) throw new Error('No character selected.');
        const result = await this.matrixService.jackIn(characterId, accountId, selected.roomId);
        respond('matrix_data', result.node);
        message(result.message, 'success');
      } else if (action === 'jackout') {
        const isEmergency = args[0] === 'fast' || args[0] === 'emergency';
        const result = await this.matrixService.jackOut(characterId, accountId, isEmergency);
        respond('matrix_data', null); // Clear matrix data
        message(result.message, isEmergency ? 'error' : 'success');
      } else if (action === 'brute') {
        const result = await this.matrixService.performHacking(characterId, accountId, 'brute');
        message(result.message, result.success ? 'success' : 'error');
        // We probably want to update matrix_data if alert level changed
        const activeNode = await this.matrixService.getActiveNode(characterId, accountId);
        if (activeNode) respond('matrix_data', activeNode);
      } else if (action === 'sleaze') {
        const result = await this.matrixService.performHacking(characterId, accountId, 'sleaze');
        message(result.message, result.success ? 'success' : 'error');
        const activeNode = await this.matrixService.getActiveNode(characterId, accountId);
        if (activeNode) respond('matrix_data', activeNode);
      } else if (action === 'spike') {
        const targetId = args[0];
        if (!targetId) {
          message('Usage: data spike <ice-id>');
          return;
        }
        const result = await this.matrixService.dataSpike(characterId, accountId, targetId);
        message(result.message, result.success ? 'success' : 'error');
        const activeNode = await this.matrixService.getActiveNode(characterId, accountId);
        if (activeNode) respond('matrix_data', activeNode);
      } else {
        message(`Unknown command: ${action}`);
      }
    } catch (err: any) {
      message(err.message || 'An error occurred.', 'error');
    }
  }
}
