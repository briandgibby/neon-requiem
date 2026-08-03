import { MedicalRepository } from './medical.repository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import {
  FieldTreatmentInput,
  FieldTreatmentResult,
  InterrogationResult,
  MedicalHealResult,
  ReviveResult,
  TreatmentCommitInput,
  TreatmentCommitResult,
} from './medical.types';
import { EcsRegistry } from '../../engine/ecs/registry';
import {
  ComponentTypes,
  DeckerComponent,
  HealthComponent,
  PlayerIdComponent,
  PositionComponent,
} from '../../engine/ecs/components';
import { PlayerRuntime } from '../../engine/player-runtime';
import { z } from 'zod';

const fieldTreatmentSchema = z.object({
  doctorId: z.string().min(1),
  accountId: z.string().min(1),
  targetEntityId: z.string().min(1),
  roomId: z.string().min(1),
});
const legacyHealSchema = z.object({
  doctorId: z.string().min(1),
  targetId: z.string().min(1),
});

const MANA_COST = 20;
const MEDICAL_SUPPLIES_SLUG = 'medical-supplies';

export class MedicalService {
  private readonly treatmentTails = new Map<string, Promise<void>>();

  constructor(
    private readonly medicalRepo: MedicalRepository,
    private readonly registry: EcsRegistry,
    private readonly playerRuntime: PlayerRuntime,
  ) {}

  async treat(input: FieldTreatmentInput): Promise<FieldTreatmentResult> {
    const parsedInput = fieldTreatmentSchema.parse(input);
    return this.withTargetTreatmentLock(
      parsedInput.targetEntityId,
      () => this.treatLocked(parsedInput),
    );
  }

  private async treatLocked(parsedInput: FieldTreatmentInput): Promise<FieldTreatmentResult> {
    const doctorEntityId = this.registry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (player) => (
        player.characterId === parsedInput.doctorId
        && player.accountId === parsedInput.accountId
      ),
    );
    if (!doctorEntityId) throw new NotFoundError('Doctor');

    const doctorPosition = this.registry.getComponent<PositionComponent>(doctorEntityId, ComponentTypes.Position);
    const targetPlayer = this.registry.getComponent<PlayerIdComponent>(parsedInput.targetEntityId, ComponentTypes.PlayerId);
    const targetPosition = this.registry.getComponent<PositionComponent>(parsedInput.targetEntityId, ComponentTypes.Position);
    const targetHealth = this.registry.getComponent<HealthComponent>(parsedInput.targetEntityId, ComponentTypes.Health);
    if (!targetPlayer || !targetPosition || !targetHealth) throw new NotFoundError('Target');
    this.assertEligibleLiveTarget(
      parsedInput,
      doctorEntityId,
      doctorPosition,
      targetPlayer,
      targetPosition,
      targetHealth,
    );

    const [doctor, persistedTarget] = await Promise.all([
      this.medicalRepo.findTreatmentActor(parsedInput.doctorId, parsedInput.accountId),
      this.medicalRepo.findTreatmentTarget(targetPlayer.characterId),
    ]);
    if (!doctor) throw new NotFoundError('Doctor');
    if (!persistedTarget) throw new NotFoundError('Target');
    if (doctor.className !== 'street-doc') {
      throw new ValidationError('Only a Street Doc can perform field treatment');
    }
    if (doctor.currentRoomId !== parsedInput.roomId) {
      throw new ValidationError('Doctor is no longer in the treatment room');
    }
    this.assertEligibleLiveTarget(
      parsedInput,
      doctorEntityId,
      doctorPosition,
      targetPlayer,
      targetPosition,
      targetHealth,
    );
    let healPower: number;
    let resource: TreatmentCommitInput['resource'];
    if (doctor.streetDocPath === 'magic') {
      if (doctor.currentMana < MANA_COST) throw new ValidationError('Insufficient Mana');
      healPower = (doctor.magic ?? 0) * 5 + 10;
      resource = { type: 'mana', amount: MANA_COST };
    } else if (doctor.streetDocPath === 'tech') {
      const supplies = doctor.inventory.find((entry) => entry.item.slug === MEDICAL_SUPPLIES_SLUG);
      if (!supplies || supplies.quantity < 1) {
        throw new ValidationError('Insufficient Medical Supplies');
      }
      healPower = doctor.logic * 4 + 15;
      resource = { type: 'inventory', inventoryItemId: supplies.id, quantity: 1 };
    } else {
      throw new ValidationError('Street Doc treatment path must be magic or tech');
    }

    const targetNextHp = Math.min(targetHealth.max, targetHealth.current + healPower);
    const hpRestored = targetNextHp - targetHealth.current;
    targetHealth.current = targetNextHp;
    let committed: TreatmentCommitResult;
    try {
      committed = await this.medicalRepo.commitTreatment({
        doctorId: parsedInput.doctorId,
        accountId: parsedInput.accountId,
        targetCharacterId: targetPlayer.characterId,
        roomId: parsedInput.roomId,
        expectedCurrentHp: persistedTarget.currentHp,
        targetNextHp,
        hpRestored,
        resource,
      });
    } catch (error) {
      targetHealth.current = Math.max(0, targetHealth.current - hpRestored);
      throw error;
    }
    if (resource.type === 'mana') {
      const liveMana = this.registry.getComponent<{ current: number }>(doctorEntityId, ComponentTypes.Mana);
      this.playerRuntime.updateVitals(parsedInput.doctorId, {
        currentMana: Math.min(liveMana?.current ?? committed.actorCurrentMana, committed.actorCurrentMana),
      });
    }
    return {
      targetCharacterId: targetPlayer.characterId,
      targetName: committed.targetName,
      targetCurrentHp: targetHealth.current,
      targetMaxHp: targetHealth.max,
      actorCurrentMana: committed.actorCurrentMana,
      resourceSpent: resource.type === 'mana' ? 'MANA' : 'SUPPLIES',
      hpRestored,
    };
  }

  private async withTargetTreatmentLock<T>(targetEntityId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.treatmentTails.get(targetEntityId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    this.treatmentTails.set(targetEntityId, tail);

    await previous;
    try {
      return await action();
    } finally {
      release();
      if (this.treatmentTails.get(targetEntityId) === tail) {
        this.treatmentTails.delete(targetEntityId);
      }
    }
  }

  private getPhysicalRoomId(entityId: string, position?: PositionComponent): string | undefined {
    const decker = this.registry.getComponent<DeckerComponent>(entityId, ComponentTypes.Decker);
    return decker?.physicalRoomId || position?.roomId;
  }

  private assertEligibleLiveTarget(
    input: FieldTreatmentInput,
    doctorEntityId: string,
    doctorPosition: PositionComponent | undefined,
    targetPlayer: PlayerIdComponent,
    targetPosition: PositionComponent,
    targetHealth: HealthComponent,
  ): void {
    if (targetPlayer.characterId === input.doctorId) {
      throw new ValidationError('A Street Doc cannot treat themself');
    }
    if (
      this.getPhysicalRoomId(doctorEntityId, doctorPosition) !== input.roomId
      || this.getPhysicalRoomId(input.targetEntityId, targetPosition) !== input.roomId
    ) {
      throw new ValidationError('Doctor and target must be in the same room');
    }
    if (targetHealth.current <= 0) {
      throw new ValidationError('Field treatment cannot revive an incapacitated target');
    }
    if (targetHealth.current >= targetHealth.max) {
      throw new ValidationError('Target is already at full health');
    }
  }

  /** @deprecated Use treat with the authenticated account and runtime entity selector. */
  async healHp(docId: string, targetId: string): Promise<MedicalHealResult> {
    const input = legacyHealSchema.parse({ doctorId: docId, targetId });
    const doctorEntityId = this.registry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (player) => player.characterId === input.doctorId,
    );
    const targetEntityId = this.registry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (player) => player.characterId === input.targetId,
    );
    if (!doctorEntityId) throw new NotFoundError('Doctor');
    if (!targetEntityId) throw new NotFoundError('Target');

    const doctor = this.registry.getComponent<PlayerIdComponent>(doctorEntityId, ComponentTypes.PlayerId)!;
    const position = this.registry.getComponent<PositionComponent>(doctorEntityId, ComponentTypes.Position);
    const roomId = this.getPhysicalRoomId(doctorEntityId, position);
    if (!roomId) throw new ValidationError('Doctor is not currently in any room');

    const result = await this.treat({
      doctorId: input.doctorId,
      accountId: doctor.accountId,
      targetEntityId,
      roomId,
    });
    return {
      success: true,
      message: `Healed ${result.targetName} for ${result.hpRestored} HP using ${result.resourceSpent}.`,
      hpRestored: result.hpRestored,
      stunRestored: 0,
      resourceSpent: result.resourceSpent,
    };
  }

  async combatRevive(docId: string, targetId: string): Promise<ReviveResult> {
    const doc = await this.medicalRepo.findCharacterById(docId);
    if (!doc) throw new NotFoundError('Doctor');

    if (doc.luck < 1) throw new ValidationError('Insufficient Luck for revival');

    const target = await this.medicalRepo.findCharacterById(targetId);
    if (!target) throw new NotFoundError('Target');
    if (target.currentHp > 0) throw new ValidationError('Target is not incapacitated');

    // Luck spend is a serious commitment
    const newLuck = doc.luck - 1;
    const hpRestored = Math.floor(target.maxHp * 0.2); // 20% HP
    
    // Death Sickness is immediate upon revival
    const sicknessDurationHours = 24;
    const sicknessUntil = new Date(Date.now() + (sicknessDurationHours * 60 * 60 * 1000));

    await this.medicalRepo.updateCharacterVitals(docId, { luck: newLuck });
    await this.medicalRepo.updateCharacterVitals(targetId, { 
      currentHp: hpRestored,
      deathSicknessUntil: sicknessUntil
    });

    return {
      success: true,
      message: `You spent a point of Luck to pull ${target.name} back from the brink! They are alive but suffer from severe death sickness.`,
      hpRestored,
      luckSpent: 1
    };
  }

  async administerTruthSerum(docId: string, targetId: string): Promise<InterrogationResult> {
    const doc = await this.medicalRepo.findCharacterById(docId);
    if (!doc) throw new NotFoundError('Doctor');

    const serumEntry = doc.inventory.find(i => i.item.slug === 'truth-serum');
    if (!serumEntry) throw new ValidationError('No Truth Serum in inventory');

    const target = await this.medicalRepo.findNPC(targetId);
    if (!target) throw new NotFoundError('Target');

    // Roll: Doc Logic vs Target Willpower
    const docRoll = doc.logic + Math.floor(Math.random() * 20) + 1;
    const targetRoll = target.willpower + 10 + Math.floor(Math.random() * 10);

    await this.medicalRepo.consumeInventoryItem(serumEntry.id, 1);

    if (docRoll >= targetRoll) {
      return {
        success: true,
        message: `${target.name}'s resistance crumbles under the serum. They reveal what they know.`,
        yieldedKey: 'INTEL_REVEALED' // Placeholder for actual mission logic
      };
    } else {
      return {
        success: false,
        message: `${target.name} fights off the effects of the serum, staring at you with defiant eyes.`
      };
    }
  }

  async applyCombatStim(docId: string, targetId: string): Promise<any> {
    const doc = await this.medicalRepo.findCharacterById(docId);
    if (!doc) throw new NotFoundError('Doctor');

    const stimEntry = doc.inventory.find(i => i.item.slug === 'combat-stim');
    if (!stimEntry) throw new ValidationError('No Combat Stims in inventory');

    const target = await this.medicalRepo.findCharacterById(targetId);
    if (!target) throw new NotFoundError('Target');

    await this.medicalRepo.consumeInventoryItem(stimEntry.id, 1);

    let message = `Administered Combat Stim to ${target.name}. Stat penalties suppressed. `;
    if (target.deathSicknessUntil && target.deathSicknessUntil > new Date()) {
      message += "The death sickness has been pushed back... for now.";
    }

    // Actual "stat suppression" and "crash" logic would be handled in the Game Loop/Buff system
    return {
      success: true,
      message
    };
  }
}
