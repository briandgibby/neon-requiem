import { CommandContext, CommandHandler } from '../command-registry';
import { WorldService } from '../../domains/world/world.service';
import { SocketHub } from '../socket-hub';
import { InstanceRepository } from '../../domains/mission/instance.repository';
import { Direction } from '../../shared/types';
import { PlayerRuntime } from '../player-runtime';

const DIRECTION_MAP: Record<string, Direction> = {
  n: 'north', s: 'south', e: 'east', w: 'west', u: 'up', d: 'down',
};

export class MoveHandler implements CommandHandler {
  readonly aliases = ['n', 's', 'e', 'w', 'u', 'd', 'north', 'south', 'east', 'west', 'up', 'down'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Move';
  readonly description = 'Move your character in a direction';
  readonly usage = '<n|s|e|w|u|d>';
  readonly argumentSource = 'direction' as const;

  constructor(
    private readonly worldService: WorldService,
    private readonly socketHub: SocketHub,
    private readonly instanceRepo: InstanceRepository,
    private readonly playerRuntime: PlayerRuntime,
  ) {}

  async execute(context: CommandContext): Promise<void> {
    const { action, characterId, accountId, output, message } = context;
    const direction: Direction = DIRECTION_MAP[action] ?? (action as Direction);

    const result = await this.worldService.moveCharacter(characterId, accountId, direction);
    if (!result.success || !result.room) {
      message(result.error || 'You cannot go that way.', 'error');
      return;
    }

    const room = result.room as any;
    this.playerRuntime.moveCharacter(characterId, room.id);
    room.occupants = this.socketHub.getRoomOccupants(room.id).filter((o) => o.characterId !== characterId);
    output.emit('room_data', room);

    const pois = await this.worldService.getPOIs(result.room.zoneId);
    output.emit('local_pois', pois);

    await this.activateInstanceIfNeeded(result.room);
  }

  private async activateInstanceIfNeeded(room: any): Promise<void> {
    if (!room?.missionInstanceId) return;
    try {
      const instance = await this.instanceRepo.findInstanceByRoomId(room.id);
      if (instance?.status === 'PENDING') {
        await this.instanceRepo.updateInstanceStatus(instance.id, 'ACTIVE');
      }
    } catch (_err) {
      // Non-fatal
    }
  }

}
