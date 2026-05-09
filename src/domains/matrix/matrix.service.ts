import { MatrixRepository } from './matrix.repository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { MatrixHackingResult, DataSpikeResult, IceAttackResult, AlertLevel, RepairResult } from './matrix.types';
import { EcsRegistry } from '../../engine/ecs/registry';
import { MoveDispatcher } from '../../engine/ecs/combat/move-dispatcher';
import { 
  ComponentTypes, 
  MatrixNodeComponent, 
  DeckerComponent, 
  IdentityComponent, 
  PlayerIdComponent,
  HealthComponent,
  StunComponent,
  ApComponent,
  AttributesComponent,
  CombatStatusComponent,
  PositionComponent,
  IceComponent
} from '../../engine/ecs/components';
import { MAX_AP } from '../../shared/constants';

export class MatrixService {
  constructor(
    private readonly matrixRepo: MatrixRepository,
    private readonly ecsRegistry: EcsRegistry,
    private readonly moveDispatcher: MoveDispatcher
  ) {}

  private async applyNeuralDamage(characterId: string, stunAmount: number, physAmount: number = 0) {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId);
    if (!character) return { stunTaken: 0, physTaken: 0, isDead: false, isUnconscious: false };

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

  async getOrCreateEcsNode(roomId: string): Promise<string> {
    let nodeEntityId = this.ecsRegistry.getEntityByComponent<MatrixNodeComponent>(
      ComponentTypes.MatrixNode,
      (c) => c.linkedRoomId === roomId
    );

    if (!nodeEntityId) {
      const nodeData = await this.matrixRepo.findNodeByRoomId(roomId);
      if (!nodeData) throw new ValidationError('No Matrix access point found in this location');

      nodeEntityId = this.ecsRegistry.createEntity();
      this.ecsRegistry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
        nodeId: nodeData.id,
        securityLevel: nodeData.securityLevel,
        alertLevel: nodeData.alertLevel as AlertLevel,
        linkedRoomId: roomId,
      });
      
      this.ecsRegistry.addComponent<IdentityComponent>(nodeEntityId, ComponentTypes.Identity, {
        name: nodeData.name,
        slug: nodeData.slug,
      });
      
      // We could spawn ICE entities here based on nodeData.activeIC
    }

    return nodeEntityId;
  }

  async jackIn(characterId: string, accountId: string, roomId: string) {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId, accountId);
    if (!character) throw new NotFoundError('Character');
    
    if (character.isJackedIn) throw new ValidationError('Already jacked into the Matrix');

    const equippedDeck = character.inventory.find(i => i.item.type === 'DECK' && i.isEquipped);
    const isTechnomancer = character.className === 'technomancer';

    if (!equippedDeck && !isTechnomancer) {
      throw new ValidationError('No Cyberdeck equipped and no neural resonance detected');
    }

    const nodeEntityId = await this.getOrCreateEcsNode(roomId);
    const node = this.ecsRegistry.getComponent<IdentityComponent>(nodeEntityId, ComponentTypes.Identity);

    await this.matrixRepo.updateCharacterLink(characterId, (node as any).id, true);

    // Setup ECS Decker Persona
    let entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (p) => p.characterId === characterId
    );

    if (!entityId) {
       entityId = this.ecsRegistry.createEntity();
       this.ecsRegistry.addComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId, { characterId, accountId });
       this.ecsRegistry.addComponent<IdentityComponent>(entityId, ComponentTypes.Identity, { name: character.name, slug: character.name.toLowerCase() });
       this.ecsRegistry.addComponent<HealthComponent>(entityId, ComponentTypes.Health, { current: character.currentHp, max: character.maxHp, lastRegenAt: Date.now() });
       this.ecsRegistry.addComponent<StunComponent>(entityId, ComponentTypes.Stun, { current: character.currentStun, max: character.maxStun, lastRegenAt: Date.now() });
       this.ecsRegistry.addComponent<AttributesComponent>(entityId, ComponentTypes.Attributes, {
         level: character.level, body: character.body, agility: character.agility, dexterity: character.dexterity,
         strength: character.strength, logic: character.logic, intuition: character.intuition,
         willpower: character.willpower, charisma: character.charisma, luck: character.luck,
       });
    }

    let attack = isTechnomancer ? (character.resAttack || 1) : 0;
    let sleaze = isTechnomancer ? (character.resSleaze || 1) : 0;
    let firewall = isTechnomancer ? (character.resFirewall || 1) : 0;
    let buffer = isTechnomancer ? ((character as any).biofeedbackBuffer || 1) : 0;

    if (equippedDeck) {
      const deckStats = equippedDeck.item.stats as any;
      attack = Math.max(attack, deckStats?.attack || 0);
      sleaze = Math.max(sleaze, deckStats?.sleaze || 0);
      firewall = Math.max(firewall, deckStats?.firewall || 0);
      buffer = Math.max(buffer, deckStats?.biofeedbackBuffer || 0);
    }

    this.ecsRegistry.addComponent<DeckerComponent>(entityId, ComponentTypes.Decker, {
      activeNodeEntityId: nodeEntityId,
      attack,
      sleaze,
      firewall,
      biofeedbackBuffer: buffer
    });

    this.ecsRegistry.addComponent<PositionComponent>(entityId, ComponentTypes.Position, { roomId: nodeEntityId });
    this.ecsRegistry.addComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus, { state: 'engaged', isPetActive: false });
    this.ecsRegistry.addComponent<ApComponent>(entityId, ComponentTypes.Ap, { current: MAX_AP, max: MAX_AP, lastRegenAt: Date.now(), recoveryTicks: 0 });

    return {
      message: `Neural link established. Welcome to ${node?.name}.`,
      node
    };
  }

  async jackOut(characterId: string, accountId: string, isEmergency: boolean = false) {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId, accountId);
    if (!character || !character.isJackedIn) {
      throw new ValidationError('Not currently jacked in');
    }

    const entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(ComponentTypes.PlayerId, p => p.characterId === characterId);
    if (entityId) {
      this.ecsRegistry.removeComponent(entityId, ComponentTypes.Decker);
      // We might destroy the entity if they are not in physical combat, but for now we just remove Decker
    }

    if (isEmergency) {
      // Dumpshock: 30% of max Stun as damage
      const damage = Math.floor(character.maxStun * 0.3);
      const { stunTaken, physTaken, isDead } = await this.applyNeuralDamage(characterId, damage);
      
      await this.matrixRepo.updateCharacterLink(characterId, null, false);
      
      let message = `EMERGENCY DISCONNECT: Dumpshock detected! You take ${stunTaken} stun damage.`;
      if (physTaken > 0) message += ` Neural overflow caused ${physTaken} physical damage!`;
      if (isDead) message += ` FATAL SYSTEM ERROR: Bio-signs terminated.`;

      return { message, damage: stunTaken + physTaken };
    }

    await this.matrixRepo.updateCharacterLink(characterId, null, false);
    return { message: 'Neural link gracefully terminated. Safe travels, Chummer.' };
  }

  async getActiveNode(characterId: string, accountId?: string) {
    const entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(ComponentTypes.PlayerId, p => p.characterId === characterId);
    if (entityId) {
       const decker = this.ecsRegistry.getComponent<DeckerComponent>(entityId, ComponentTypes.Decker);
       if (decker) {
          const node = this.ecsRegistry.getComponent<MatrixNodeComponent>(decker.activeNodeEntityId, ComponentTypes.MatrixNode);
          if (node) return node;
       }
    }
    
    // Fallback to DB
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId, accountId);
    if (!character?.activeNodeId) return null;
    return this.matrixRepo.findNodeById(character.activeNodeId);
  }

  async performHacking(characterId: string, accountId: string, type: 'brute' | 'sleaze'): Promise<any> {
    const actorId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(ComponentTypes.PlayerId, p => p.characterId === characterId);
    if (!actorId) throw new ValidationError('Not currently jacked into a node');

    const result = await this.moveDispatcher.dispatch(
      type,
      actorId,
      actorId, // Self-targeted for now since they target the node they are in
      { registry: this.ecsRegistry }
    );

    return {
      success: result.success,
      message: result.message,
      newAlertLevel: result.data.newAlertLevel
    };
  }

  async dataSpike(characterId: string, accountId: string, iceId: string): Promise<any> {
    const actorId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(ComponentTypes.PlayerId, p => p.characterId === characterId);
    if (!actorId) throw new ValidationError('Not jacked in');

    // Need to find the ICE entity ID
    const targetId = this.ecsRegistry.getEntityByComponent<IceComponent>(ComponentTypes.Ice, c => (c as any).id === iceId); // Assumes we stored DB id somewhere, needs fixing later if we spawn ICE properly. Let's assume iceId passed IS the EntityId for now.

    const result = await this.moveDispatcher.dispatch(
      'data-spike',
      actorId,
      iceId, // Assume iceId is EntityId
      { registry: this.ecsRegistry }
    );

    return {
      success: result.success,
      message: result.message,
      damageDealt: result.data.damageDealt,
      nodeAlertLevel: result.data.newAlertLevel
    };
  }

  async processIceTurn(characterId: string): Promise<IceAttackResult[]> {
    // This logic is now handled by IceAiSystem globally, so this method is mostly obsolete for active gameplay,
    // but might be kept for specific targeted DB updates if we don't sync fully.
    // For now, we will return empty and let ECS handle it.
    return [];
  }

  async repairProgram(characterId: string, accountId: string, inventoryItemId: string): Promise<RepairResult> {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId, accountId);
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
