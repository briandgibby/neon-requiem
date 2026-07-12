import { CommandContext, CommandHandler } from '../command-registry';
import { WorldService } from '../../domains/world/world.service';
import { SocketHub } from '../socket-hub';
import { InstanceRepository } from '../../domains/mission/instance.repository';
import { EcsRegistry } from '../ecs/registry';
import { ComponentTypes, PlayerIdComponent, PositionComponent } from '../ecs/components';

export class NavigateHandler implements CommandHandler {
  readonly aliases = ['navigate'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Navigate';
  readonly description = 'Auto-navigate to a known point of interest';
  readonly usage = '<poi>';

  constructor(
    private readonly worldService: WorldService,
    private readonly socketHub: SocketHub,
    private readonly instanceRepo: InstanceRepository,
    private readonly ecsRegistry: EcsRegistry,
  ) {}

  async execute(context: CommandContext): Promise<void> {
    const { characterId, accountId, args, output, message } = context;

    const targetSlug = args[0];
    if (!targetSlug) {
      message('Usage: navigate <poi>');
      return;
    }

    const results = await this.worldService.navigate(characterId, accountId, targetSlug);

    for (const result of results) {
      if (result.success && result.room) {
        const room = result.room as any;
        this.syncEcsPosition(characterId, room.id);
        room.occupants = this.socketHub.getRoomOccupants(room.id).filter((o) => o.characterId !== characterId);
        output.emit('room_data', room);
        await this.activateInstanceIfNeeded(result.room);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        message(result.error || 'Navigation failed.', 'error');
        break;
      }
    }

    if (results.length > 0 && results[results.length - 1].success) {
      const finalRoom = results[results.length - 1].room!;
      const pois = await this.worldService.getPOIs(finalRoom.zoneId);
      output.emit('local_pois', pois);
    }
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

  private syncEcsPosition(characterId: string, roomId: string): void {
    const entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (player) => player.characterId === characterId,
    );
    if (!entityId) return;

    const position = this.ecsRegistry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
    if (position) position.roomId = roomId;
  }
}
