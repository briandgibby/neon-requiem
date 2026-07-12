import { CombatRepository } from './combat.repository';
import { CharacterRepository } from '../character/character.repository';
import { WorldRepository } from '../world/world.repository';
import { MobRepository } from './mob.repository';
import { MagicService } from '../magic/magic.service';
import { MatrixService } from '../matrix/matrix.service';
import { MoveInput, SecurityAlarmResult } from './combat.types';
import { 
  MAX_AP, 
} from '../../shared/constants';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { Tickable } from '../../engine/heartbeat';
import { EcsRegistry } from '../../engine/ecs/registry';
import { MoveDispatcher } from '../../engine/ecs/combat/move-dispatcher';
import {
  ComponentTypes,
  CombatSessionComponent,
  CombatStatusComponent,
  ApComponent,
  PlayerIdComponent,
} from '../../engine/ecs/components';
import { PlayerEntityFactory } from '../../engine/ecs/factories/player-entity-factory';

import { PlayerSyncCoordinator } from '../../engine/player-sync-coordinator';

export interface SafeZonePolicy {
  isEffectiveSafeZone(roomId: string): Promise<boolean>;
}

export class CombatService implements Tickable {
  readonly name = 'CombatService';
  readonly frequency = 1; // Process combat every tick

  constructor(
    private readonly combatRepo: CombatRepository,
    private readonly charRepo: CharacterRepository,
    private readonly worldRepo: WorldRepository,
    private readonly safeZonePolicy: SafeZonePolicy,
    private readonly mobRepo: MobRepository,
    private readonly magicService: MagicService,
    private readonly matrixService: MatrixService,
    private readonly ecsRegistry: EcsRegistry,
    private readonly moveDispatcher: MoveDispatcher,
    private readonly syncCoordinator: PlayerSyncCoordinator,
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    // ECS Systems now handle the simulation tick independently.
    // We only need to sync state to DB if we want periodic persistence.
    if (_tickCount % 20 === 0) {
      await this.syncCoordinator.syncAllPlayers();
    }
  }

  async getOrCreateEcsSession(roomId: string): Promise<string> {
    let sessionId = this.ecsRegistry.getEntityByComponent<CombatSessionComponent>(
      ComponentTypes.CombatSession,
      (c) => c.roomId === roomId
    );

    if (!sessionId) {
      const room = await this.worldRepo.findRoomById(roomId);
      sessionId = this.ecsRegistry.createEntity();
      this.ecsRegistry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId,
        securityRating: room?.securityRating || 'C',
        alarmState: 'GREEN',
        turnsUntilReinforcements: null,
        backupCalled: false,
        tick: 0,
      });
    }

    return sessionId;
  }

  async triggerSecurityAlarm(roomId: string): Promise<SecurityAlarmResult> {
    if (await this.safeZonePolicy.isEffectiveSafeZone(roomId)) {
      return { triggered: false, reason: 'safe_zone' };
    }

    const sessionId = await this.getOrCreateEcsSession(roomId);
    const session = this.ecsRegistry.getComponent<CombatSessionComponent>(
      sessionId,
      ComponentTypes.CombatSession
    );

    if (!session) throw new ValidationError('Combat session not found');

    session.alarmState = 'RED';
    session.backupCalled = true;
    session.turnsUntilReinforcements = 1;

    return { triggered: true };
  }

  async joinCombat(characterId: string, accountId: string, roomId: string): Promise<void> {
    const character = await this.charRepo.findByIdAndAccount(characterId, accountId);
    if (!character) throw new NotFoundError('Character');

    const sessionId = await this.getOrCreateEcsSession(roomId);
    
    // Check if character already in ECS combat
    let entityId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (p) => p.characterId === characterId
    );

    if (entityId) {
      const status = this.ecsRegistry.getComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus);
      if (status) status.sessionId = sessionId;
      return;
    }

    entityId = PlayerEntityFactory.createFromRecord(this.ecsRegistry, character, roomId);

    this.ecsRegistry.addComponent<ApComponent>(entityId, ComponentTypes.Ap, {
      current: MAX_AP,
      max: MAX_AP,
      lastRegenAt: Date.now(),
      recoveryTicks: 0,
    });

    this.ecsRegistry.addComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus, {
      state: 'engaged',
      isPetActive: false,
      sessionId,
    });
  }

  async performMove(input: MoveInput): Promise<any> {
    const character = await this.charRepo.findByIdAndAccount(input.characterId, input.accountId);
    if (!character) throw new NotFoundError('Character');

    const actorId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (p) => p.characterId === input.characterId
    );

    if (!actorId) throw new ValidationError('Character is not in combat');

    const result = await this.moveDispatcher.dispatch(
      input.move,
      actorId,
      input.targetId,
      { registry: this.ecsRegistry }
    );

    await this.syncCoordinator.syncAllPlayers();
    return result;
  }
}
