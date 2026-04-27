import { MedicalRepository } from './medical.repository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { MedicalHealResult, ReviveResult, InterrogationResult } from './medical.types';

export class MedicalService {
  constructor(private readonly medicalRepo: MedicalRepository) {}

  async healHp(docId: string, targetId: string): Promise<MedicalHealResult> {
    const doc = await this.medicalRepo.findCharacterById(docId);
    if (!doc) throw new NotFoundError('Doctor');

    const target = await this.medicalRepo.findCharacterById(targetId);
    if (!target) throw new NotFoundError('Target');

    let hpRestored = 0;
    let resourceSpent = '';

    if (doc.streetDocPath === 'magic') {
      // Magic Path: Uses Mana
      const manaCost = 20;
      if (doc.currentMana < manaCost) throw new ValidationError('Insufficient Mana');
      
      hpRestored = doc.magic ? (doc.magic * 5) + 10 : 10;
      await this.medicalRepo.updateCharacterVitals(docId, { currentMana: doc.currentMana - manaCost });
      resourceSpent = 'MANA';
    } else {
      // Tech Path: Uses Supplies
      const supplyEntry = doc.inventory.find(i => i.item.slug === 'medical-supplies');
      if (!supplyEntry || supplyEntry.quantity < 1) throw new ValidationError('Insufficient Medical Supplies');
      
      hpRestored = doc.logic ? (doc.logic * 4) + 15 : 15;
      await this.medicalRepo.consumeInventoryItem(supplyEntry.id, 1);
      resourceSpent = 'SUPPLIES';
    }

    const newHp = Math.min(target.maxHp, target.currentHp + hpRestored);
    await this.medicalRepo.updateCharacterVitals(targetId, { currentHp: newHp });

    return {
      success: true,
      message: `Healed ${target.name} for ${hpRestored} HP using ${resourceSpent}.`,
      hpRestored,
      stunRestored: 0,
      resourceSpent
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
