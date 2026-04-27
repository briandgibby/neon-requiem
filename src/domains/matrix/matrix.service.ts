import { MatrixRepository } from './matrix.repository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { MatrixHackingResult, DataSpikeResult, IceAttackResult, AlertLevel, RepairResult } from './matrix.types';

export class MatrixService {
  constructor(private readonly matrixRepo: MatrixRepository) {}

  private async applyNeuralDamage(character: any, stunAmount: number, physAmount: number = 0) {
    let newStun = character.currentStun - stunAmount;
    let overflow = 0;

    if (newStun < 0) {
      overflow = Math.abs(newStun);
      newStun = 0;
    }

    const totalPhysDamage = physAmount + overflow;
    const newHp = Math.max(0, character.currentHp - totalPhysDamage);

    await this.matrixRepo.updateCharacterStun(character.id, newStun);
    if (totalPhysDamage > 0) {
      await this.matrixRepo.updateCharacterHp(character.id, newHp);
    }

    return { stunTaken: stunAmount - overflow, physTaken: totalPhysDamage, isDead: newHp <= 0, isUnconscious: newStun <= 0 && newHp > 0 };
  }

  async jackIn(characterId: string, roomId: string) {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId);
    if (!character) throw new NotFoundError('Character');
    
    if (character.isJackedIn) throw new ValidationError('Already jacked into the Matrix');

    // Check for equipment (Cyberdeck) or Technomancer class
    const equippedDeck = character.inventory.find(i => i.item.type === 'DECK' && i.isEquipped);
    const isTechnomancer = character.className === 'technomancer';

    if (!equippedDeck && !isTechnomancer) {
      throw new ValidationError('No Cyberdeck equipped and no neural resonance detected');
    }

    const node = await this.matrixRepo.findNodeByRoomId(roomId);
    if (!node) {
      throw new ValidationError('No Matrix access point found in this location');
    }

    await this.matrixRepo.updateCharacterLink(characterId, node.id, true);

    return {
      message: `Neural link established. Welcome to ${node.name}.`,
      node
    };
  }

  async jackOut(characterId: string, isEmergency: boolean = false) {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId);
    if (!character || !character.isJackedIn) {
      throw new ValidationError('Not currently jacked in');
    }

    if (isEmergency) {
      // Dumpshock: 30% of max Stun as damage
      const damage = Math.floor(character.maxStun * 0.3);
      const { stunTaken, physTaken, isDead } = await this.applyNeuralDamage(character, damage);
      
      await this.matrixRepo.updateCharacterLink(characterId, null, false);
      
      let message = `EMERGENCY DISCONNECT: Dumpshock detected! You take ${stunTaken} stun damage.`;
      if (physTaken > 0) message += ` Neural overflow caused ${physTaken} physical damage!`;
      if (isDead) message += ` FATAL SYSTEM ERROR: Bio-signs terminated.`;

      return { message, damage: stunTaken + physTaken };
    }

    await this.matrixRepo.updateCharacterLink(characterId, null, false);
    return { message: 'Neural link gracefully terminated. Safe travels, Chummer.' };
  }

  async getActiveNode(characterId: string) {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId);
    if (!character?.activeNodeId) return null;
    return this.matrixRepo.findNodeById(character.activeNodeId);
  }

  async performHacking(characterId: string, type: 'brute' | 'sleaze'): Promise<MatrixHackingResult> {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId);
    if (!character || !character.isJackedIn || !character.activeNodeId) {
      throw new ValidationError('Not currently jacked into a node');
    }

    const node = await this.matrixRepo.findNodeById(character.activeNodeId);
    if (!node) throw new NotFoundError('Matrix Node');

    const isTechnomancer = character.className === 'technomancer';
    const equippedDeck = character.inventory.find(i => i.item.type === 'DECK' && i.isEquipped);

    // Calculate Matrix Stats
    let attack = isTechnomancer ? (character.resAttack || 1) : 0;
    let sleaze = isTechnomancer ? (character.resSleaze || 1) : 0;

    if (equippedDeck) {
      const deckStats = equippedDeck.item.stats as any;
      attack = Math.max(attack, deckStats?.attack || 0);
      sleaze = Math.max(sleaze, deckStats?.sleaze || 0);
    }

    // Success = (IntM + Stat) + 1d20 vs (NodeSecurity * 2) + 10
    const intM = character.intuition + character.logic;
    const stat = type === 'brute' ? attack : sleaze;
    const playerRoll = intM + stat + Math.floor(Math.random() * 20) + 1;
    const nodeRoll = (node.securityLevel * 2) + 10 + Math.floor(Math.random() * 10);

    const success = playerRoll >= nodeRoll;
    const newAlertLevel = (type === 'brute' ? 'RED' : (success ? node.alertLevel : 'YELLOW')) as AlertLevel;

    if (newAlertLevel !== node.alertLevel) {
      await this.matrixRepo.updateNodeAlert(node.id, newAlertLevel);
    }

    if (type === 'brute') {
      return {
        success,
        message: success ? 'Data-lock shattered. System access granted.' : 'Node firewall holds firm. Alert triggered.',
        newAlertLevel: 'RED'
      };
    } else {
      return {
        success,
        message: success ? 'Ghosting successful. System compromised silently.' : 'Connection flagged. Node searching for intruder.',
        newAlertLevel
      };
    }
  }

  async dataSpike(characterId: string, iceId: string): Promise<DataSpikeResult> {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId);
    if (!character || !character.isJackedIn) throw new ValidationError('Not jacked in');

    const node = await this.matrixRepo.findNodeById(character.activeNodeId!);
    if (!node) throw new NotFoundError('Node');

    const ice = node.activeIC.find(i => i.id === iceId);
    if (!ice) throw new NotFoundError('ICE');

    const isTechnomancer = character.className === 'technomancer';
    const equippedDeck = character.inventory.find(i => i.item.type === 'DECK' && i.isEquipped);

    let attack = isTechnomancer ? (character.resAttack || 1) : 0;
    if (equippedDeck) {
      attack = Math.max(attack, (equippedDeck.item.stats as any)?.attack || 0);
    }

    // Spike = (Logic + Attack) + 1d20 vs (ICE Defense + 10)
    const playerRoll = character.logic + attack + Math.floor(Math.random() * 20) + 1;
    const iceRoll = ice.defense + 10 + Math.floor(Math.random() * 10);

    const success = playerRoll >= iceRoll;
    let damageDealt = 0;
    let newIceHp = ice.currentHp;

    if (success) {
      damageDealt = Math.max(5, playerRoll - iceRoll);
      newIceHp = Math.max(0, ice.currentHp - damageDealt);
      await this.matrixRepo.updateIceHp(iceId, newIceHp);
    }

    // A data spike always alerts the node if not already red
    if (node.alertLevel !== 'RED') {
      await this.matrixRepo.updateNodeAlert(node.id, 'RED');
    }

    return {
      success,
      message: success ? `Data Spike successful! ${ice.name} integrity compromised.` : `Data Spike resisted by ${ice.name}.`,
      damageDealt,
      iceRemainingHp: newIceHp,
      nodeAlertLevel: 'RED'
    };
  }

  async processIceTurn(characterId: string): Promise<IceAttackResult[]> {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId);
    if (!character || !character.activeNodeId) return [];

    const node = await this.matrixRepo.findNodeById(character.activeNodeId);
    if (!node || node.alertLevel !== 'RED') return [];

    const results: IceAttackResult[] = [];

    for (const ice of node.activeIC) {
      if (ice.currentHp <= 0) continue;

      // ICE Attack = (ICE Attack Stat) + 1d10
      const iceRoll = ice.attack + Math.floor(Math.random() * 10) + 1;
      
      const isTechnomancer = character.className === 'technomancer';
      const equippedDeck = character.inventory.find(i => i.item.type === 'DECK' && i.isEquipped);
      
      let resisted = false;
      let damage = Math.max(2, iceRoll - 5); // Base damage calculation

      if (ice.type === 'BLACK') {
        // Biofeedback Resistance: Body + Willpower + Buffer + 1d10
        const physResistRoll = character.body + character.willpower + (character.biofeedbackBuffer || 0) + Math.floor(Math.random() * 10) + 1;
        resisted = physResistRoll >= iceRoll;
        
        if (resisted) {
          results.push({ iceName: ice.name, damage: 0, message: `Your physical constitution resists the biofeedback from ${ice.name}!`, resisted: true });
          continue;
        }

        const actualDamage = Math.max(5, iceRoll - physResistRoll);
        await this.applyNeuralDamage(character, 0, actualDamage);
        results.push({ iceName: ice.name, damage: actualDamage, message: `${ice.name} delivers a lethal bio-feedback shock!`, resisted: false });
      } else {
        // Neural/Program Resistance (Hardening): Logic + Firewall + 1d10
        let firewall = isTechnomancer ? (character.resFirewall || 1) : 0;
        if (equippedDeck) {
          firewall = Math.max(firewall, (equippedDeck.item.stats as any)?.firewall || 0);
        }

        const neuralResistRoll = character.logic + firewall + Math.floor(Math.random() * 10) + 1;
        resisted = neuralResistRoll >= iceRoll;

        if (resisted) {
          results.push({ iceName: ice.name, damage: 0, message: `Your neural hardening deflects the attack from ${ice.name}!`, resisted: true });
          continue;
        }

        const actualDamage = Math.max(2, iceRoll - neuralResistRoll);
        let message = '';

        if (ice.type === 'WHITE') {
          message = `${ice.name} slows your neural buffer. Action latency increased.`;
          await this.applyNeuralDamage(character, actualDamage, 0);
        } else if (ice.type === 'GRAY') {
          const programs = character.inventory.filter((i: any) => i.item.type === 'PROGRAM' && i.isEquipped && i.corruptionLevel < 3);
          if (programs.length > 0) {
            const target = programs[Math.floor(Math.random() * programs.length)];
            const newLevel = target.corruptionLevel + 1;
            await this.matrixRepo.corruptProgram(target.id, newLevel);
            const severity = newLevel === 1 ? 'LIGHT' : (newLevel === 2 ? 'MEDIUM' : 'HEAVY');
            message = `${ice.name} has caused ${severity} corruption to your ${target.item.name} code!`;
          } else {
            message = `${ice.name} searches for code to corrupt but finds nothing. Dealing neural stun instead.`;
            await this.applyNeuralDamage(character, actualDamage, 0);
          }
        }

        results.push({ iceName: ice.name, damage: actualDamage, message, resisted: false });
      }
    }

    return results;
  }

  async repairProgram(characterId: string, inventoryItemId: string): Promise<RepairResult> {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId);
    if (!character || !character.isJackedIn) throw new ValidationError('Not jacked in');

    const program = character.inventory.find(i => i.id === inventoryItemId);
    if (!program) throw new NotFoundError('Program');
    if (program.corruptionLevel === 0) throw new ValidationError('Program is not corrupted');

    const newLevel = program.corruptionLevel - 1;
    await this.matrixRepo.repairProgram(inventoryItemId, newLevel);

    let message = `Repairing ${program.item.name}... `;
    if (newLevel === 0) {
      message += 'Code integrity restored! Program is now stable.';
    } else {
      message += `Neural patches applied. Remaining corruption level: ${newLevel}.`;
    }

    return {
      success: true,
      message,
      remainingCorruption: newLevel,
      inventoryItemId
    };
  }
}
