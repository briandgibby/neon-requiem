import { CommandOutput } from './command-dispatcher';

export type ExecutionMode = 'physical' | 'matrix' | 'wireless' | 'any';
export type CommandArgumentSource = 'direction' | 'poi' | 'ice';
export type CommandArgumentSuggestionSource = 'occupant';

export interface CommandContext {
  action: string;
  characterId: string;
  accountId: string;
  args: string[];
  argsString: string;
  roomId: string;
  characterName: string;
  output: CommandOutput;
  message(text: string, type?: string): void;
}

export interface CommandHandler {
  readonly aliases: readonly string[];
  readonly mode: ExecutionMode;
  readonly label: string;
  readonly description: string;
  readonly usage?: string;
  readonly argumentSource?: CommandArgumentSource;
  readonly argumentSuggestionSource?: CommandArgumentSuggestionSource;
  execute(context: CommandContext): Promise<void>;
}

export interface CommandMetadata {
  aliases: string[];
  mode: ExecutionMode;
  label: string;
  description: string;
  usage?: string;
  argumentSource?: CommandArgumentSource;
  argumentSuggestionSource?: CommandArgumentSuggestionSource;
}

export class CommandRegistry {
  private readonly byAlias = new Map<string, CommandHandler>();
  private readonly all: CommandHandler[] = [];

  register(handler: CommandHandler): void {
    for (const alias of handler.aliases) {
      this.byAlias.set(alias, handler);
    }
    this.all.push(handler);
  }

  get(action: string): CommandHandler | undefined {
    return this.byAlias.get(action);
  }

  getAll(): CommandHandler[] {
    return this.all;
  }
}

export function listCommandMetadata(registry: CommandRegistry): CommandMetadata[] {
  return registry.getAll().map((handler) => ({
    aliases: [...handler.aliases],
    mode: handler.mode,
    label: handler.label,
    description: handler.description,
    usage: handler.usage,
    argumentSource: handler.argumentSource,
    argumentSuggestionSource: handler.argumentSuggestionSource,
  }));
}
