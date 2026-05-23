import { CommandContext, CommandHandler } from '../command-registry';
import { SocketHub } from '../socket-hub';

export class TellHandler implements CommandHandler {
  readonly aliases = ['tell'] as const;
  readonly mode = 'any' as const;
  readonly label = 'Tell';
  readonly description = 'Send a private message to another player';
  readonly usage = '<name> <message>';

  constructor(private readonly socketHub: SocketHub) {}

  async execute(context: CommandContext): Promise<void> {
    const { characterName, args, output, message } = context;
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
      from: characterName,
      text: chatContent,
      scope: 'tell',
    });

    output.emit('chat_message', {
      from: `to ${targetName}`,
      text: chatContent,
      scope: 'tell',
    });
  }
}
