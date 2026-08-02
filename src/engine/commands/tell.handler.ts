import { CommandContext, CommandHandler } from '../command-registry';
import { SocketHub } from '../socket-hub';
import { decodeCharacterSelector } from '../../shared/character-selector';

export class TellHandler implements CommandHandler {
  readonly aliases = ['tell'] as const;
  readonly mode = 'any' as const;
  readonly label = 'Tell';
  readonly description = 'Send a private message to another player';
  readonly usage = '<name> <message>';
  readonly argumentSuggestionSource = 'occupant' as const;

  constructor(private readonly socketHub: SocketHub) {}

  async execute(context: CommandContext): Promise<void> {
    const { characterName, args, output, message } = context;
    const targetSelector = args[0];
    const chatContent = args.slice(1).join(' ').trim();

    if (!targetSelector || !chatContent) {
      message('Usage: tell <name> <message>');
      return;
    }

    let targetName = targetSelector;
    let targetSocketId: string | null;
    const targetCharacterId = decodeCharacterSelector(targetSelector);
    if (targetCharacterId !== null) {
      const target = this.socketHub.findCharacterById(targetCharacterId);
      targetName = target?.name ?? 'That character';
      targetSocketId = target?.socketId ?? null;
    } else {
      targetSocketId = this.socketHub.findSocketForCharacter(targetSelector);
    }

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
