import { CombatRepository } from './combat.repository';
import { CharacterRepository } from '../character/character.repository';
import { WorldRepository } from '../world/world.repository';
import { MobRepository } from './mob.repository';
import { MagicService } from '../magic/magic.service';
import { MatrixService } from '../matrix/matrix.service';
import { CombatSession, CombatParticipant, MoveInput, HitResult } from './combat.types';
import { 
  MAX_AP, 
  COMMAND_AP_PENALTY, 
  AP_COSTS, 
  SECURITY_RESPONSE_TIMES, 
  BASE_WEAPON_POWER,
  ALARM_SUPPRESSION_DIFFICULTY 
} from '../../shared/constants';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { calculateHitType, calculateAbsorbType, resolveHit } from './combat.math';

export class CombatService {
  constructor(
    private readonly combatRepo: CombatRepository,
    private readonly charRepo: CharacterRepository,
    private readonly worldRepo: WorldRepository,
    private readonly mobRepo: MobRepository,
    private readonly magicService: MagicService,
    private readonly matrixService: MatrixService,
  ) {}

  async getOrCreateSession(roomId: string): Promise<CombatSession> {
    let session = await this.combatRepo.getSessionByRoom(roomId);
    if (!session) {
      const room = await this.worldRepo.findRoomById(roomId);
      session = {
        id: `combat_${roomId}`,
        roomId,
        securityRating: room?.securityRating || 'C',
        participants: {},
        tick: 0,
        alarmState: 'GREEN',
        turnsUntilReinforcements: null,
        backupCalled: false,
      };
      await this.combatRepo.saveSession(session);
    }
    return session;
  }

  async joinCombat(characterId: string, roomId: string): Promise<void> {
    const character = await this.charRepo.findById(characterId);
    if (!character) throw new NotFoundError('Character');

    const session = await this.getOrCreateSession(roomId);
    
    if (session.participants[characterId]) return;

    const participant: CombatParticipant = {
      id: characterId,
      name: character.name,
      type: 'player',
      hp: character.currentHp,
      maxHp: character.maxHp,
      stun: character.currentStun,
      maxStun: character.maxStun,
      mana: character.currentMana,
      maxMana: character.maxMana,
      ap: MAX_AP,
      maxAp: MAX_AP,
      status: 'idle',
      recoveryTicks: 0,
      isPetActive: false,
      level: character.level,
      body: character.body,
      agility: character.agility,
      dexterity: character.dexterity,
      strength: character.strength,
      logic: character.logic,
      intuition: character.intuition,
      willpower: character.willpower,
      charisma: character.charisma,
      luck: character.luck,
      masteryCQC: character.masteryCQC,
      masteryPistol: character.masteryPistol,
      masteryRifle: character.masteryRifle,
      masteryAutomatic: character.masteryAutomatic,
      armorValue: character.armorValue,
    };

    session.participants[characterId] = participant;
    await this.combatRepo.saveSession(session);
  }

  async performMove(input: MoveInput): Promise<any> {
    const session = await this.combatRepo.findSessionByParticipant(input.characterId);
    if (!session) throw new ValidationError('Character is not in combat');

    const actor = session.participants[input.characterId]!;
    const target = session.participants[input.targetId];

    if (actor.status === 'recovering') {
      if (input.move !== 'consume') {
        throw new ValidationError('Cannot perform actions while recovering (except consume)');
      }
    }

    const apCost = AP_COSTS[input.move] || 0;
    if (actor.ap < apCost) {
      throw new ValidationError('Not enough Action Points');
    }

    // Spend AP
    actor.ap -= apCost;
    if (actor.ap <= 0) {
      actor.status = 'recovering';
      actor.recoveryTicks = Math.max(2, 10 - Math.floor((actor.intuition + actor.level / 2) / 2)); 
    }

    let result: any = { message: `You perform ${input.move}.` };

    switch (input.move) {
      case 'attack':
        result = await this.handleAttack(session, actor, target!);
        break;
      case 'cast':
        result = await this.handleCast(session, actor, target, input.spellSlug!);
        break;
      case 'hack':
        result = await this.handleHack(session, actor, target, input.matrixAction!);
        break;
      case 'guard':
        actor.status = 'guarding';
        result = { message: 'You take a defensive stance.' };
        break;
      case 'flee':
        const success = Math.random() > 0.5;
        if (success) {
          delete session.participants[input.characterId];
          result = { message: 'You successfully flee from combat!' };
        } else {
          result = { message: 'You fail to flee!' };
        }
        break;
      case 'call-backup':
        result = await this.handleCallBackup(session, actor);
        break;
      case 'suppress-alarm':
        result = await this.handleSuppressAlarm(session, actor);
        break;
    }

    await this.syncParticipantStates(session);
    await this.combatRepo.saveSession(session);
    return result;
  }

  private async handleAttack(session: CombatSession, actor: CombatParticipant, target: CombatParticipant): Promise<HitResult> {
    if (!target) throw new ValidationError('Target not found');
    
    let hitType = calculateHitType(actor, target, 'attack');
    
    if (target.status === 'guarding' && hitType === 'solid') {
      if (Math.random() < 0.5) hitType = 'glancing';
    }

    const weaponPower = BASE_WEAPON_POWER; 
    const absorbType = calculateAbsorbType(weaponPower, target);
    const result = resolveHit(hitType, 10 + actor.strength, absorbType);
    
    let finalDamage = result.finalDamage;
    if (target.status === 'guarding') {
      finalDamage = Math.floor(finalDamage * 0.8);
    }

    target.hp -= finalDamage;
    if (target.hp < 0) target.hp = 0;

    if (target.hp === 0) {
      await this.worldRepo.updateRoom(session.roomId, { isClean: false, lastCombatAt: new Date() });
    }

    let counterResult = null;
    if (target.status === 'guarding' && (hitType === 'dodge' || hitType === 'glancing')) {
      const counterHitType = calculateHitType(target, actor, 'attack');
      if (counterHitType !== 'dodge') {
         counterResult = resolveHit(counterHitType, Math.floor((10 + target.strength) / 2), 'none');
         actor.hp -= counterResult.finalDamage;
      }
    }

    return { ...result, finalDamage, counter: counterResult };
  }

  private async handleCast(session: CombatSession, actor: CombatParticipant, target: CombatParticipant | undefined, spellSlug: string) {
    if (!spellSlug) throw new ValidationError('No spell selected');
    
    // Delegate complex mana/reagent/drain logic to MagicService
    const castResult = await this.magicService.castSpell(actor.id, spellSlug, target?.id);
    
    // Update actor state from cast result
    actor.mana -= castResult.manaSpent;
    actor.hp -= castResult.drainTaken;
    
    if (castResult.success && target) {
      // Apply effect (Simplified: direct damage for now)
      const damage = castResult.effectValue;
      target.hp -= damage;
      if (target.hp < 0) target.hp = 0;
    }

    return castResult;
  }

  private async handleHack(session: CombatSession, actor: CombatParticipant, target: CombatParticipant | undefined, action: string) {
    // Basic integration: suppressing alarm is handled here
    if (action === 'suppress-alarm') {
        return this.handleSuppressAlarm(session, actor);
    }
    // Future: more matrix actions in combat (e.g. bricking cyberware)
    return { message: 'Matrix action performed.' };
  }

  private async handleCallBackup(session: CombatSession, actor: CombatParticipant) {
    if (actor.type !== 'npc') throw new ValidationError('Only NPCs can call for backup');
    if (session.backupCalled) return { message: 'Backup already inbound.' };

    session.backupCalled = true;
    session.alarmState = 'YELLOW';
    const responseTime = SECURITY_RESPONSE_TIMES[session.securityRating] || 10;
    session.turnsUntilReinforcements = responseTime;

    return { message: `${actor.name} has signaled for reinforcements! Response in ${responseTime} turns.` };
  }

  private async handleSuppressAlarm(session: CombatSession, actor: CombatParticipant) {
    // Use stats from participant record
    const roll = actor.logic + (actor.level / 2) + Math.floor(Math.random() * 20) + 1;
    const difficulty = ALARM_SUPPRESSION_DIFFICULTY[session.securityRating] || 15;

    if (roll >= difficulty) {
      if (session.backupCalled && session.turnsUntilReinforcements !== null) {
        session.turnsUntilReinforcements += 2;
        return { message: `Neural interference successful! Backup delayed by 2 turns.` };
      }
      return { message: `Electronic countermeasures active. Backup communication lines jammed.` };
    }
    return { message: `Static hiss fills your link. Countermeasures failed.` };
  }

  private async syncParticipantStates(session: CombatSession) {
    for (const p of Object.values(session.participants)) {
      if (p.type === 'player') {
        await this.charRepo.updateCharacter(p.id, {
          currentHp: p.hp,
          currentStun: p.stun,
          currentMana: p.mana,
        });
      }
    }
  }

  async processTick(roomId: string): Promise<void> {
    const session = await this.combatRepo.getSessionByRoom(roomId);
    if (!session) return;

    session.tick++;

    if (session.backupCalled && session.turnsUntilReinforcements !== null) {
      if (session.turnsUntilReinforcements > 0) {
        session.turnsUntilReinforcements--;
      } else {
        await this.spawnReinforcements(session);
        session.turnsUntilReinforcements = null; 
      }
    }

    for (const participant of Object.values(session.participants)) {
      if (participant.status === 'recovering') {
        participant.recoveryTicks--;
        if (participant.recoveryTicks <= 0) {
          participant.status = 'engaged';
          participant.ap = participant.maxAp;
          if (participant.isPetActive) {
            participant.ap -= COMMAND_AP_PENALTY;
          }
        }
      }
    }

    await this.combatRepo.saveSession(session);
  }

  private async spawnReinforcements(session: CombatSession) {
    const template = await this.mobRepo.findBySlug('security-guard');
    const reinforcementId = `reinforcement_${session.tick}_${Math.random().toString(36).substr(2, 5)}`;
    const participant: CombatParticipant = {
      id: reinforcementId,
      name: template?.name || 'Security Reinforcement',
      type: 'npc',
      hp: template?.maxHp || 80,
      maxHp: template?.maxHp || 80,
      stun: 0,
      maxStun: 40,
      mana: 0,
      maxMana: 0,
      ap: MAX_AP,
      maxAp: MAX_AP,
      status: 'engaged',
      recoveryTicks: 0,
      isPetActive: false,
      level: template?.level || 5,
      agility: template?.agility || 5,
      intuition: template?.intuition || 4,
      strength: template?.strength || 6,
      body: template?.body || 6,
      luck: 0,
      masteryCQC: template?.masteryCQC || 4,
      masteryPistol: template?.masteryPistol || 4,
      masteryRifle: template?.masteryRifle || 0,
      masteryAutomatic: template?.masteryAutomatic || 0,
      armorValue: template?.armorValue || 5,
    };
    session.participants[reinforcementId] = participant;
    session.alarmState = 'RED';
  }
}
