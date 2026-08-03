import { CommandContext, CommandHandler, CommandRegistry, listCommandMetadata } from '../../src/engine/command-registry';
import { MoveHandler } from '../../src/engine/commands/move.handler';
import { NavigateHandler } from '../../src/engine/commands/navigate.handler';
import { DataSpikeHandler } from '../../src/engine/commands/spike.handler';
import { TellHandler } from '../../src/engine/commands/tell.handler';

class TestCommand implements CommandHandler {
  readonly aliases = ['scan', 's'] as const;
  readonly mode = 'matrix' as const;
  readonly label = 'Scan';
  readonly description = 'Inspect the local node';
  readonly usage = '<target>';
  readonly argumentSource = 'ice' as const;
  readonly argumentSuggestionSource = 'occupant' as const;

  async execute(_context: CommandContext): Promise<void> {}
}

describe('CommandRegistry metadata', () => {
  it('serializes registered commands without exposing executors', () => {
    const registry = new CommandRegistry();
    registry.register(new TestCommand());

    expect(listCommandMetadata(registry)).toEqual([
      {
        aliases: ['scan', 's'],
        mode: 'matrix',
        label: 'Scan',
        description: 'Inspect the local node',
        usage: '<target>',
        argumentSource: 'ice',
        argumentSuggestionSource: 'occupant',
      },
    ]);
  });

  it('declares option sources for commands backed by live game entities', () => {
    expect(new MoveHandler({} as any, {} as any, {} as any, {} as any).argumentSource).toBe('direction');
    expect(new NavigateHandler({} as any, {} as any, {} as any, {} as any).argumentSource).toBe('poi');
    expect(new DataSpikeHandler({} as any).argumentSource).toBe('ice');
    expect(new TellHandler({} as any).argumentSuggestionSource).toBe('occupant');
  });
});
