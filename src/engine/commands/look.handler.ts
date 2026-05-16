import { CommandContext, CommandHandler } from '../command-registry';
import { WorldService } from '../../domains/world/world.service';
import { MatrixService } from '../../domains/matrix/matrix.service';
import { SocketHub } from '../socket-hub';

export class LookHandler implements CommandHandler {
  readonly aliases = ['look'] as const;
  readonly mode = 'any' as const;
  readonly label = 'Look';
  readonly description = 'Examine your current surroundings';

  constructor(
    private readonly worldService: WorldService,
    private readonly matrixService: MatrixService,
    private readonly socketHub: SocketHub,
  ) {}

  async execute(context: CommandContext): Promise<void> {
    const { characterId, accountId, roomId, output } = context;

    const activeNode = await this.matrixService.getActiveNode(characterId, accountId);
    if (activeNode) {
      output.emit('matrix_data', activeNode);
      return;
    }

    const room = await this.worldService.getRoom(roomId) as any;
    room.occupants = this.socketHub.getRoomOccupants(room.id).filter((o) => o.characterId !== characterId);
    output.emit('room_data', room);
    output.emit('room_occupants', this.socketHub.getRoomOccupants(room.id));
  }
}
