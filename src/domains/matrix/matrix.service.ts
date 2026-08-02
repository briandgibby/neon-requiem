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
  IceComponent,
  ApComponent,
  CombatStatusComponent,
  PositionComponent,
} from '../../engine/ecs/components';
import { PlayerEntityFactory } from '../../engine/ecs/factories/player-entity-factory';
import { MAX_AP } from '../../shared/constants';
import type { InstanceAlertAuthority } from '../mission/instance-alert.service';

type NodeCreatedCallback = (roomId: string, nodeEntityId: string) => Promise<void>;
type MatrixCharacterRecord = NonNullable<Awaited<ReturnType<MatrixRepository['getCharacterWithEquipment']>>>;

interface MatrixNodeView {
  id: string;
  nodeId: string;
  name?: string;
  slug?: string;
  securityLevel: number;
  alertLevel: AlertLevel;
  linkedRoomId: string | null;
  activeIC: {
    id: string;
    entityId: string;
    name?: string;
    slug?: string;
    type: IceComponent['type'];
    currentHp: number;
    maxHp: number;
  }[];
}

export class MatrixService {
  constructor(
    private readonly matrixRepo: MatrixRepository,
    private readonly ecsRegistry: EcsRegistry,
    private readonly moveDispatcher: MoveDispatcher,
    private readonly onNodeCreated?: NodeCreatedCallback,
    private readonly instanceAlerts?: InstanceAlertAuthority,
  ) {}

  private async persistNodeAlert(node: MatrixNodeComponent): Promise<void> {
    try {
      await this.matrixRepo.updateNodeAlert(node.nodeId, node.alertLevel);
    } catch (_err) {
      // ECS state remains authoritative for the active session.
    }

    if (!this.instanceAlerts || !node.linkedRoomId || node.alertLevel === 'GREEN') return;
    try {
      await this.instanceAlerts.escalateAlertFromRoom(node.linkedRoomId, node.alertLevel);
    } catch (_err) {
      // The next Matrix tick will retry plane synchronization.
    }
  }

  async createInstanceNode(params: {
    slug: string;
    name: string;
    roomId: string;
    securityLevel: number;
    requiresPhysicalPresence: boolean;
  }): Promise<void> {
    await this.matrixRepo.createMatrixNode(params);
  }

  private getEcsNodeView(nodeEntityId: string): MatrixNodeView | null {
    const node = this.ecsRegistry.getComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode);
    if (!node) return null;

    const identity = this.ecsRegistry.getComponent<IdentityComponent>(nodeEntityId, ComponentTypes.Identity);

    const iceIds = this.ecsRegistry.getEntitiesWith([ComponentTypes.Ice, ComponentTypes.Position]);
    const activeIC = iceIds.flatMap((iceEntityId) => {
      const position = this.ecsRegistry.getComponent<PositionComponent>(iceEntityId, ComponentTypes.Position);
      if (position?.roomId !== nodeEntityId) return [];

      const ice = this.ecsRegistry.getComponent<IceComponent>(iceEntityId, ComponentTypes.Ice);
      const iceIdentity = this.ecsRegistry.getComponent<IdentityComponent>(iceEntityId, ComponentTypes.Identity);
      const health = this.ecsRegistry.getComponent<HealthComponent>(iceEntityId, ComponentTypes.Health);
      if (!ice || !health) return [];

      return [{
        id: ice.iceId ?? iceEntityId,
        entityId: iceEntityId,
        name: iceIdentity?.name,
        slug: iceIdentity?.slug,
        type: ice.type,
        currentHp: health.current,
        maxHp: health.max,
      }];
    });

    return {
      id: node.nodeId,
      nodeId: node.nodeId,
      name: identity?.name,
      slug: identity?.slug,
      securityLevel: node.securityLevel,
      alertLevel: node.alertLevel as AlertLevel,
      linkedRoomId: node.linkedRoomId,
      activeIC,
    };
  }

  private getPersistedNodeView(
    node: NonNullable<Awaited<ReturnType<MatrixRepository['findNodeById']>>>
  ): MatrixNodeView {
    return {
      id: node.id,
      nodeId: node.id,
      name: node.name,
      slug: node.slug,
      securityLevel: node.securityLevel,
      alertLevel: node.alertLevel as AlertLevel,
      linkedRoomId: node.roomId,
      activeIC: node.activeIC.map((ice) => ({
        id: ice.id,
        entityId: ice.id,
        name: ice.name,
        slug: ice.slug,
        type: ice.type as IceComponent['type'],
        currentHp: ice.currentHp,
        maxHp: ice.hp,
      })),
    };
  }

  private spawnIceForNode(nodeEntityId: string, activeIC: any[] = []): void {
    const existingIceIds = this.ecsRegistry.getEntitiesWith([ComponentTypes.Ice, ComponentTypes.Position]);
    const existingIceByDbId = new Set(
      existingIceIds.flatMap((iceEntityId) => {
        const position = this.ecsRegistry.getComponent<PositionComponent>(iceEntityId, ComponentTypes.Position);
        if (position?.roomId !== nodeEntityId) return [];

        const ice = this.ecsRegistry.getComponent<IceComponent>(iceEntityId, ComponentTypes.Ice);
        return ice?.iceId ? [ice.iceId] : [];
      })
    );

    for (const iceData of activeIC) {
      if (existingIceByDbId.has(iceData.id)) continue;

      const iceEntityId = this.ecsRegistry.createEntity();
      this.ecsRegistry.addComponent<IceComponent>(iceEntityId, ComponentTypes.Ice, {
        iceId: iceData.id,
        type: iceData.type,
        attack: iceData.attack,
        defense: iceData.defense,
      });
      this.ecsRegistry.addComponent<HealthComponent>(iceEntityId, ComponentTypes.Health, {
        current: iceData.currentHp,
        max: iceData.hp,
        lastRegenAt: Date.now(),
      });
      this.ecsRegistry.addComponent<PositionComponent>(iceEntityId, ComponentTypes.Position, {
        roomId: nodeEntityId,
      });
      this.ecsRegistry.addComponent<IdentityComponent>(iceEntityId, ComponentTypes.Identity, {
        name: iceData.name,
        slug: iceData.slug,
      });
    }
  }

  private attachDeckerPersona(
    character: MatrixCharacterRecord,
    nodeEntityId: string,
    physicalRoomId: string,
    sessionState: { currentAp: number; recoveryTicks: number; overwatchScore: number },
  ): void {
    const equippedDeck = character.inventory.find((item) => item.item.type === 'DECK' && item.isEquipped);
    const isTechnomancer = character.className === 'technomancer';
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

    let entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (player) => player.characterId === character.id,
    );
    if (!entityId) {
      entityId = PlayerEntityFactory.createFromRecord(this.ecsRegistry, character, physicalRoomId);
    } else {
      const position = this.ecsRegistry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
      if (position) position.roomId = physicalRoomId;
      else this.ecsRegistry.addComponent<PositionComponent>(entityId, ComponentTypes.Position, { roomId: physicalRoomId });
    }

    this.ecsRegistry.addComponent<DeckerComponent>(entityId, ComponentTypes.Decker, {
      activeNodeEntityId: nodeEntityId,
      physicalRoomId,
      attack,
      sleaze,
      firewall,
      biofeedbackBuffer: buffer,
      overwatchScore: sessionState.overwatchScore,
    });
    this.ecsRegistry.addComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus, {
      state: sessionState.currentAp <= 0 ? 'recovering' : 'engaged',
      isPetActive: false,
    });
    this.ecsRegistry.addComponent<ApComponent>(entityId, ComponentTypes.Ap, {
      current: sessionState.currentAp,
      max: MAX_AP,
      lastRegenAt: Date.now(),
      recoveryTicks: sessionState.currentAp <= 0
        ? Math.max(1, sessionState.recoveryTicks)
        : 0,
    });
  }

  private resolveIceTargetId(activeNodeEntityId: string, requestedIceId: string): string {
    const directTarget = this.ecsRegistry.getComponent<IceComponent>(requestedIceId, ComponentTypes.Ice);
    if (directTarget) {
      const position = this.ecsRegistry.getComponent<PositionComponent>(requestedIceId, ComponentTypes.Position);
      if (!position || position.roomId === activeNodeEntityId) return requestedIceId;
    }

    const matchingIceEntityId = this.ecsRegistry.getEntityByComponent<IceComponent>(
      ComponentTypes.Ice,
      (ice) => ice.iceId === requestedIceId
    );
    if (!matchingIceEntityId) throw new NotFoundError('ICE');

    const position = this.ecsRegistry.getComponent<PositionComponent>(matchingIceEntityId, ComponentTypes.Position);
    if (position?.roomId !== activeNodeEntityId) throw new NotFoundError('ICE');

    return matchingIceEntityId;
  }

  private getOwnedPlayerEntity(characterId: string, accountId: string): string | null {
    const entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (p) => p.characterId === characterId
    );

    if (!entityId) return null;

    const player = this.ecsRegistry.getComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId);
    if (!player || player.accountId !== accountId) throw new NotFoundError('Character');

    return entityId;
  }

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

      const existingAfterLoad = this.ecsRegistry.getEntityByComponent<MatrixNodeComponent>(
        ComponentTypes.MatrixNode,
        (component) => component.linkedRoomId === roomId,
      );
      if (existingAfterLoad) return existingAfterLoad;

      nodeEntityId = this.ecsRegistry.createEntity();
      this.ecsRegistry.addComponent<MatrixNodeComponent>(nodeEntityId, ComponentTypes.MatrixNode, {
        nodeId: nodeData.id,
        securityLevel: nodeData.securityLevel,
        alertLevel: nodeData.alertLevel as AlertLevel,
        linkedRoomId: roomId,
        breachProgress: 0,
      });
      
      this.ecsRegistry.addComponent<IdentityComponent>(nodeEntityId, ComponentTypes.Identity, {
        name: nodeData.name,
        slug: nodeData.slug,
      });

      this.spawnIceForNode(nodeEntityId, nodeData.activeIC);

      if (this.onNodeCreated) {
        try {
          await this.onNodeCreated(roomId, nodeEntityId);
        } catch (_err) {
          // Non-fatal
        }
      }
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

    // Check physical presence requirement for instance nodes
    const nodeData = await this.matrixRepo.findNodeByRoomId(roomId);
    if (nodeData && (nodeData as any).requiresPhysicalPresence) {
      const room = await this.matrixRepo.findRoomById(roomId);
      if (!room?.missionInstanceId) {
        throw new ValidationError('This host requires a hardline connection — you need to be on-site.');
      }
    }

    const nodeEntityId = await this.getOrCreateEcsNode(roomId);
    const node = this.getEcsNodeView(nodeEntityId);
    if (!node) throw new ValidationError('Active Matrix Node not found');

    await this.matrixRepo.updateCharacterLink(characterId, node.id, true, {
      currentAp: MAX_AP,
      recoveryTicks: 0,
      overwatchScore: 0,
    });

    this.attachDeckerPersona(character, nodeEntityId, roomId, {
      currentAp: MAX_AP,
      recoveryTicks: 0,
      overwatchScore: 0,
    });

    return {
      message: `Neural link established. Welcome to ${node?.name}.`,
      node
    };
  }

  async restoreSession(
    characterId: string,
    accountId: string,
    signal?: AbortSignal,
  ): Promise<MatrixNodeView | null> {
    if (signal?.aborted) return null;
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId, accountId);
    if (signal?.aborted) return null;
    if (!character) throw new NotFoundError('Character');
    if (!character.isJackedIn) {
      if (signal?.aborted) return null;
      if (character.activeNodeId) await this.matrixRepo.updateCharacterLink(characterId, null, false);
      return null;
    }
    if (!character.activeNodeId) {
      if (signal?.aborted) return null;
      await this.matrixRepo.updateCharacterLink(characterId, null, false);
      return null;
    }

    const persistedNode = await this.matrixRepo.findNodeById(character.activeNodeId);
    if (signal?.aborted) return null;
    if (!persistedNode) {
      await this.matrixRepo.updateCharacterLink(characterId, null, false);
      return null;
    }

    const physicalRoomId = character.currentRoomId ?? persistedNode.roomId;
    const nodeEntityId = await this.getOrCreateEcsNode(persistedNode.roomId);
    if (signal?.aborted) return null;
    this.attachDeckerPersona(character, nodeEntityId, physicalRoomId, {
      currentAp: character.currentAp,
      recoveryTicks: character.apRecoveryTicks,
      overwatchScore: character.matrixOverwatchScore,
    });
    return this.getEcsNodeView(nodeEntityId);
  }

  async jackOut(characterId: string, accountId: string, isEmergency: boolean = false) {
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId, accountId);
    if (!character || !character.isJackedIn) {
      throw new ValidationError('Not currently jacked in');
    }

    const entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(ComponentTypes.PlayerId, p => p.characterId === characterId);
    if (entityId) {
      const decker = this.ecsRegistry.getComponent<DeckerComponent>(entityId, ComponentTypes.Decker);
      const physicalRoomId = decker?.physicalRoomId;

      this.ecsRegistry.removeComponent(entityId, ComponentTypes.Decker);

      // Restore physical position now that the matrix dive is over
      if (physicalRoomId) {
        const pos = this.ecsRegistry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
        if (pos) pos.roomId = physicalRoomId;
      }
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
       const player = this.ecsRegistry.getComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId);
       if (accountId && player?.accountId !== accountId) return null;

       const decker = this.ecsRegistry.getComponent<DeckerComponent>(entityId, ComponentTypes.Decker);
       if (decker) {
          const node = this.getEcsNodeView(decker.activeNodeEntityId);
          if (node) return node;
       }
    }
    
    // Fallback to DB
    const character = await this.matrixRepo.getCharacterWithEquipment(characterId, accountId);
    if (!character?.activeNodeId) return null;
    const node = await this.matrixRepo.findNodeById(character.activeNodeId);
    return node ? this.getPersistedNodeView(node) : null;
  }

  async performHacking(characterId: string, accountId: string, type: 'brute' | 'sleaze'): Promise<any> {
    const actorId = this.getOwnedPlayerEntity(characterId, accountId);
    if (!actorId) throw new ValidationError('Not currently jacked into a node');

    const result = await this.moveDispatcher.dispatch(
      type,
      actorId,
      actorId,
      { registry: this.ecsRegistry }
    );

    // Flush alert and update breach progress
    const decker = this.ecsRegistry.getComponent<DeckerComponent>(actorId, ComponentTypes.Decker);
    if (decker) {
      const node = this.ecsRegistry.getComponent<MatrixNodeComponent>(decker.activeNodeEntityId, ComponentTypes.MatrixNode);
      if (node) {
        await this.persistNodeAlert(node);
        if (result.success) {
          node.breachProgress += 1;
        }
      }
      decker.overwatchScore += 1;
    }

    return {
      success: result.success,
      message: result.message,
      newAlertLevel: result.data.newAlertLevel,
    };
  }

  async dataSpike(characterId: string, accountId: string, iceId: string): Promise<any> {
    const actorId = this.getOwnedPlayerEntity(characterId, accountId);
    if (!actorId) throw new ValidationError('Not jacked in');

    const decker = this.ecsRegistry.getComponent<DeckerComponent>(actorId, ComponentTypes.Decker);
    if (!decker) throw new ValidationError('Not jacked in');

    const targetId = this.resolveIceTargetId(decker.activeNodeEntityId, iceId);

    const result = await this.moveDispatcher.dispatch(
      'data-spike',
      actorId,
      targetId,
      { registry: this.ecsRegistry }
    );

    // Flush ICE HP to DB
    const targetIce = this.ecsRegistry.getComponent<IceComponent>(targetId, ComponentTypes.Ice);
    const targetHealth = this.ecsRegistry.getComponent<HealthComponent>(targetId, ComponentTypes.Health);
    if (targetIce?.iceId && targetHealth) {
      try {
        await this.matrixRepo.updateIceHp(targetIce.iceId, targetHealth.current);
      } catch (_err) {
        // Non-fatal
      }
    }

    const node = this.ecsRegistry.getComponent<MatrixNodeComponent>(decker.activeNodeEntityId, ComponentTypes.MatrixNode);
    if (node) await this.persistNodeAlert(node);

    // Increment OS stub
    decker.overwatchScore += 1;

    return {
      success: result.success,
      message: result.message,
      damageDealt: result.data.damageDealt,
      nodeAlertLevel: result.data.newAlertLevel,
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
