import { CommandContext, CommandHandler, CommandRegistry, listCommandMetadata } from '../../src/engine/command-registry';

class TestCommand implements CommandHandler {
  readonly aliases = ['scan', 's'] as const;
  readonly mode = 'matrix' as const;
  readonly label = 'Scan';
  readonly description = 'Inspect the local node';
  readonly usage = '<target>';

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
      },
    ]);
  });
});
