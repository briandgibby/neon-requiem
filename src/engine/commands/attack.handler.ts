import { CombatService } from '../../domains/combat/combat.service';
import { CommandContext, CommandHandler } from '../command-registry';

export class AttackHandler implements CommandHandler {
  readonly aliases = ['attack'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Attack';
  readonly description = 'Attack a hostile entity in your current room';
  readonly usage = '<target>';
  readonly argumentSource = 'hostile' as const;

  constructor(private readonly combatService: CombatService) {}

  async execute(context: CommandContext): Promise<void> {
    const targetId = context.args[0];
    if (!targetId) {
      context.message('Usage: attack <target>', 'error');
      return;
    }

    const targets = await this.combatService.listTargets(context.characterId, context.accountId);
    if (!targets.hostiles.some((target) => target.id === targetId)) {
      context.message('That target is not a living hostile in your current room.', 'error');
      return;
    }

    await this.combatService.joinCombat(context.characterId, context.accountId, context.roomId);
    const result = await this.combatService.performMove({
      characterId: context.characterId,
      accountId: context.accountId,
      targetId,
      move: 'attack',
    });
    context.message(result.message, result.success ? 'combat' : 'error');
    if (result.data?.actorState) {
      context.output.emit('character_update', result.data.actorState);
    }
    context.output.emit('combat_targets', await this.combatService.listTargets(context.characterId, context.accountId));
  }
}
