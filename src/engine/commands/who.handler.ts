import { CommandContext, CommandHandler } from '../command-registry';
import { SocketHub } from '../socket-hub';

export class WhoHandler implements CommandHandler {
  readonly aliases = ['who'] as const;
  readonly mode = 'any' as const;
  readonly label = 'Who';
  readonly description = 'List who is in the current room';

  constructor(private readonly socketHub: SocketHub) {}

  async execute(context: CommandContext): Promise<void> {
    const { characterId, roomId, message } = context;
    const occupants = this.socketHub.getRoomOccupants(roomId);
    const names = occupants
      .filter((o) => o.characterId !== characterId)
      .map((o) => o.name)
      .join(', ');
    message(names ? `Here: ${names}` : 'No one else is visible here.');
  }
}
