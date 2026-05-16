import { CommandContext, CommandHandler } from '../command-registry';
import { CommandRegistry } from '../command-registry';

export class HelpHandler implements CommandHandler {
  readonly aliases = ['help'] as const;
  readonly mode = 'any' as const;
  readonly label = 'Help';
  readonly description = 'List all available commands';

  constructor(private readonly registry: CommandRegistry) {}

  async execute(context: CommandContext): Promise<void> {
    const { message } = context;
    const handlers = this.registry.getAll();
    const lines = handlers.map((h) => {
      const cmd = h.usage ? `${h.aliases[0]} ${h.usage}` : h.aliases[0];
      return `  ${cmd.padEnd(24)} ${h.description}`;
    });
    message(`Commands:\n${lines.join('\n')}`);
  }
}
