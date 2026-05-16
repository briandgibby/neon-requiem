import { CommandContext, CommandHandler } from '../command-registry';
import { SocketHub } from '../socket-hub';

export class SayHandler implements CommandHandler {
  readonly aliases = ['say'] as const;
  readonly mode = 'any' as const;
  readonly label = 'Say';
  readonly description = 'Speak aloud to everyone in the room';
  readonly usage = '<message>';

  constructor(private readonly socketHub: SocketHub) {}

  async execute(context: CommandContext): Promise<void> {
    const { roomId, characterName, argsString, message } = context;
    if (!argsString) {
      message('Usage: say <message>');
      return;
    }
    this.socketHub.emitToRoom(roomId, 'chat_message', {
      from: characterName,
      text: argsString,
      scope: 'room',
    });
  }
}
