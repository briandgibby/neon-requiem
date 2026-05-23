import { SocketHub } from './socket-hub';
import { EcsRegistry } from './ecs/registry';
import { ComponentTypes, DeckerComponent, PlayerIdComponent, CharacterClassComponent } from './ecs/components';
import { CommandRegistry, CommandContext } from './command-registry';

export interface CommandOutput {
  emit(event: string, data: any): void;
  data: {
    characterId?: string;
    accountId?: string;
  };
}

const WIRELESS_CLASSES = new Set(['decker', 'technomancer', 'rigger']);

const MULTI_WORD_NORMALIZATION: Record<string, string> = {
  'jack in': 'jackin',
  'jack out': 'jackout',
  'data spike': 'spike',
};

export class CommandDispatcher {
  constructor(
    private readonly registry: CommandRegistry,
    private readonly socketHub: SocketHub,
    private readonly ecsRegistry: EcsRegistry,
  ) {}

  async dispatch(output: CommandOutput, commandText: string): Promise<void> {
    if (!output.data.characterId || !output.data.accountId) return;

    const rawCommand = commandText.trim();
    if (!rawCommand) return;

    // 1. Normalize multi-word commands, then split into action + args
    const { action, argsString } = this.parseCommand(rawCommand);
    const args = argsString ? argsString.split(/\s+/) : [];

    // 2. Look up handler
    const handler = this.registry.get(action);
    if (!handler) {
      output.emit('message', { text: `Unknown command: ${action}` });
      return;
    }

    // 3. Resolve selected character
    const selected = this.socketHub.getSelectedClient(output as any);
    if (!selected) {
      output.emit('message', { text: 'No character selected.', type: 'error' });
      return;
    }

    // 4. Mode guard
    const modeError = this.checkMode(handler.mode, selected.characterId);
    if (modeError) {
      output.emit('message', { text: modeError, type: 'error' });
      return;
    }

    // 5. Execute
    const context: CommandContext = {
      action,
      characterId: selected.characterId,
      accountId: selected.accountId,
      args,
      argsString,
      roomId: selected.roomId,
      characterName: selected.characterName,
      output,
      message: (text: string, type = 'info') => output.emit('message', { text, type }),
    };

    try {
      await handler.execute(context);
    } catch (err: any) {
      output.emit('message', { text: err.message || 'An error occurred.', type: 'error' });
    }
  }

  private parseCommand(rawCommand: string): { action: string; argsString: string } {
    const lower = rawCommand.toLowerCase();

    for (const [phrase, normalized] of Object.entries(MULTI_WORD_NORMALIZATION)) {
      if (lower.startsWith(phrase)) {
        const remainder = rawCommand.slice(phrase.length).trim();
        return { action: normalized, argsString: remainder };
      }
    }

    const firstSpace = rawCommand.indexOf(' ');
    if (firstSpace === -1) {
      return { action: lower, argsString: '' };
    }
    return {
      action: rawCommand.slice(0, firstSpace).toLowerCase(),
      argsString: rawCommand.slice(firstSpace + 1).trim(),
    };
  }

  private checkMode(mode: string, characterId: string): string | null {
    const jackedIn = this.isJackedIn(characterId);

    if (mode === 'physical' && jackedIn) {
      return 'Your body is unresponsive — you are deep in the matrix.';
    }

    if (mode === 'matrix' && !jackedIn) {
      return 'You are not jacked into a matrix node.';
    }

    if (mode === 'wireless') {
      if (jackedIn) return 'Your body is unresponsive — you are deep in the matrix.';
      if (!this.hasWirelessCapability(characterId)) {
        return 'You lack the neural hardware for wireless access.';
      }
    }

    return null;
  }

  private isJackedIn(characterId: string): boolean {
    const entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (p) => p.characterId === characterId,
    );
    if (!entityId) return false;
    return !!this.ecsRegistry.getComponent<DeckerComponent>(entityId, ComponentTypes.Decker);
  }

  private hasWirelessCapability(characterId: string): boolean {
    const entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (p) => p.characterId === characterId,
    );
    if (!entityId) return false;
    const classComp = this.ecsRegistry.getComponent<CharacterClassComponent>(
      entityId,
      ComponentTypes.CharacterClass,
    );
    return !!classComp && WIRELESS_CLASSES.has(classComp.className);
  }
}
