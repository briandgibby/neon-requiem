import { CombatService } from '../../domains/combat/combat.service';
import { CommandContext, CommandHandler } from '../command-registry';

export class GuardHandler implements CommandHandler {
  readonly aliases = ['guard'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Guard';
  readonly description = 'Guard another Character in your current room';
  readonly usage = '<ally>';
  readonly argumentSource = 'ally' as const;

  constructor(private readonly combatService: CombatService) {}

  async execute(context: CommandContext): Promise<void> {
    const targetId = context.args[0];
    if (!targetId) {
      context.message('Usage: guard <ally>', 'error');
      return;
    }

    const targets = await this.combatService.listTargets(context.characterId, context.accountId);
    if (!targets.allies.some((target) => target.id === targetId)) {
      context.message('That target is not a living ally in your current room.', 'error');
      return;
    }

    await this.combatService.joinCombat(context.characterId, context.accountId, context.roomId);
    const result = await this.combatService.performMove({
      characterId: context.characterId,
      accountId: context.accountId,
      targetId,
      move: 'guard',
    });
    context.message(result.message, result.success ? 'success' : 'error');
    if (result.data?.actorState) {
      context.output.emit('character_update', result.data.actorState);
    }
  }
}
