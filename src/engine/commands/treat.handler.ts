import { CombatService } from '../../domains/combat/combat.service';
import { MedicalService } from '../../domains/medical/medical.service';
import { CharacterUpdatePublisher } from '../character-update-publisher';
import { CommandContext, CommandHandler } from '../command-registry';
import { RoomEventPublisher } from '../room-event-publisher';

export class TreatHandler implements CommandHandler {
  readonly aliases = ['treat'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Treat';
  readonly description = 'Treat an injured ally in your current room';
  readonly usage = '<ally>';
  readonly argumentSource = 'injured-ally' as const;

  constructor(
    private readonly medicalService: MedicalService,
    private readonly combatService: CombatService,
    private readonly roomEvents: RoomEventPublisher,
    private readonly characterUpdates: CharacterUpdatePublisher,
  ) {}

  async execute(context: CommandContext): Promise<void> {
    const targetEntityId = context.args[0];
    if (!targetEntityId) {
      context.message('Usage: treat <ally>', 'error');
      return;
    }

    const result = await this.medicalService.treat({
      doctorId: context.characterId,
      accountId: context.accountId,
      targetEntityId,
      roomId: context.roomId,
    });
    const resourceLabel = result.resourceSpent === 'MANA' ? 'Mana' : 'Medical Supplies';
    this.roomEvents.publish(context.roomId, {
      text: `${context.characterName} treats ${result.targetName} for ${result.hpRestored} HP using ${resourceLabel}.`,
      type: 'info',
    });
    context.output.emit('character_update', { currentMana: result.actorCurrentMana });
    this.characterUpdates.publish(result.targetCharacterId, {
      currentHp: result.targetCurrentHp,
      maxHp: result.targetMaxHp,
    });
    context.output.emit(
      'combat_targets',
      await this.combatService.listTargets(context.characterId, context.accountId),
    );
  }
}
