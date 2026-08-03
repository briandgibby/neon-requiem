import { CombatRepository } from './combat.repository';
import { CharacterRepository } from '../character/character.repository';
import { WorldRepository } from '../world/world.repository';
import { SafeZonePolicy } from '../world/world.types';
import { MobRepository } from './mob.repository';
import { MagicService } from '../magic/magic.service';
import { MatrixService } from '../matrix/matrix.service';
import { MobTemplateRecord, MoveInput, SecurityAlarmResult } from './combat.types';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { Tickable } from '../../engine/heartbeat';
import { EcsRegistry } from '../../engine/ecs/registry';
import { MoveDispatcher } from '../../engine/ecs/combat/move-dispatcher';
import {
  ComponentTypes,
  CombatSessionComponent,
  CombatStatusComponent,
  PlayerIdComponent,
  AiComponent,
  DeckerComponent,
  HealthComponent,
  IdentityComponent,
  PositionComponent,
} from '../../engine/ecs/components';
import { PlayerRuntime } from '../../engine/player-runtime';

import { PlayerSyncCoordinator } from '../../engine/player-sync-coordinator';
import type { InstanceAlertAuthority } from '../mission/instance-alert.service';
import { z } from 'zod';

const characterAccessSchema = z.object({
  characterId: z.string().min(1),
  accountId: z.string().min(1),
});
const joinCombatSchema = characterAccessSchema.extend({ roomId: z.string().min(1) });
const moveInputSchema = characterAccessSchema.extend({
  targetId: z.string().min(1),
  move: z.enum([
    'attack', 'guard', 'backstab', 'scattershot', 'aimed-shot', 'trip', 'flee', 'consume',
    'cast', 'hack', 'call-backup', 'suppress-alarm', 'brute', 'sleaze', 'data-spike',
  ]),
  spellSlug: z.string().min(1).optional(),
  matrixAction: z.string().min(1).optional(),
});

export class CombatService implements Tickable {
  readonly name = 'CombatService';
  readonly frequency = 1; // Process combat every tick
  private readonly playerRuntime: PlayerRuntime;

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
    private readonly instanceAlerts?: InstanceAlertAuthority,
    playerRuntime?: PlayerRuntime,
  ) {
    this.playerRuntime = playerRuntime ?? new PlayerRuntime(ecsRegistry);
  }

  async onTick(_tickCount: number): Promise<void> {
    // ECS Systems now handle the simulation tick independently.
    // We only need to sync state to DB if we want periodic persistence.
    if (_tickCount % 20 === 0) {
      await this.syncCoordinator.syncAllPlayers();
    }
  }

  getMobTemplate(id: string): Promise<MobTemplateRecord | null> {
    return this.mobRepo.findById(id);
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

    if (this.instanceAlerts) {
      try {
        await this.instanceAlerts.escalateAlertFromRoom(roomId, 'RED');
      } catch (_err) {
        // AlertPatrolSystem retries non-GREEN CombatSessions on each tick.
      }
    }

    return { triggered: true };
  }

  async findMobTemplateBySlug(slug: string): Promise<MobTemplateRecord | null> {
    return this.mobRepo.findBySlug(slug);
  }

  async findEliteMobTemplateByCorporation(corporationId: string): Promise<MobTemplateRecord | null> {
    return this.mobRepo.findEliteByCorporation(corporationId);
  }

  async listTargets(characterId: string, accountId: string): Promise<{
    hostiles: { id: string; name: string; currentHp: number; maxHp: number }[];
    allies: { id: string; name: string; currentHp: number; maxHp: number }[];
  }> {
    const input = characterAccessSchema.parse({ characterId, accountId });
    const character = await this.charRepo.findByIdAndAccount(input.characterId, input.accountId);
    if (!character) throw new NotFoundError('Character');
    if (!character.currentRoomId) throw new ValidationError('Character is not currently in any room');

    const hostiles = this.ecsRegistry.getEntitiesWith([
      ComponentTypes.NpcId,
      ComponentTypes.Ai,
      ComponentTypes.Position,
      ComponentTypes.Identity,
      ComponentTypes.Health,
    ]).flatMap((entityId) => {
      const ai = this.ecsRegistry.getComponent<AiComponent>(entityId, ComponentTypes.Ai);
      const position = this.ecsRegistry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
      const identity = this.ecsRegistry.getComponent<IdentityComponent>(entityId, ComponentTypes.Identity);
      const health = this.ecsRegistry.getComponent<HealthComponent>(entityId, ComponentTypes.Health);
      if (ai?.state !== 'hostile' || position?.roomId !== character.currentRoomId || !identity || !health || health.current <= 0) {
        return [];
      }
      return [{ id: entityId, name: identity.name, currentHp: health.current, maxHp: health.max }];
    });

    const allies = this.ecsRegistry.getEntitiesWith([
      ComponentTypes.PlayerId,
      ComponentTypes.Position,
      ComponentTypes.Identity,
      ComponentTypes.Health,
    ]).flatMap((entityId) => {
      const player = this.ecsRegistry.getComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId);
      const position = this.ecsRegistry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
      const decker = this.ecsRegistry.getComponent<DeckerComponent>(entityId, ComponentTypes.Decker);
      const identity = this.ecsRegistry.getComponent<IdentityComponent>(entityId, ComponentTypes.Identity);
      const health = this.ecsRegistry.getComponent<HealthComponent>(entityId, ComponentTypes.Health);
      const physicalRoomId = decker?.physicalRoomId ?? position?.roomId;
      if (player?.characterId === characterId || physicalRoomId !== character.currentRoomId || !identity || !health || health.current <= 0) {
        return [];
      }
      return [{ id: entityId, name: identity.name, currentHp: health.current, maxHp: health.max }];
    });

    const byName = (a: { name: string; id: string }, b: { name: string; id: string }) => (
      a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    );
    return { hostiles: hostiles.sort(byName), allies: allies.sort(byName) };
  }

  async joinCombat(characterId: string, accountId: string, roomId: string): Promise<void> {
    const input = joinCombatSchema.parse({ characterId, accountId, roomId });
    const character = await this.charRepo.findByIdAndAccount(input.characterId, input.accountId);
    if (!character) throw new NotFoundError('Character');
    if (character.currentRoomId !== input.roomId) {
      throw new ValidationError('Character is not in that room');
    }

    const sessionId = await this.getOrCreateEcsSession(input.roomId);

    const entityId = this.playerRuntime.loadCharacter(character, input.roomId);
    const status = this.ecsRegistry.getComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus);
    if (status) {
      status.sessionId = sessionId;
      if (status.state === 'idle') status.state = 'engaged';
    }
  }

  async performMove(input: MoveInput): Promise<any> {
    const parsedInput = moveInputSchema.parse(input) as MoveInput;
    const character = await this.charRepo.findByIdAndAccount(parsedInput.characterId, parsedInput.accountId);
    if (!character) throw new NotFoundError('Character');

    const actorId = this.ecsRegistry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (p) => p.characterId === parsedInput.characterId
    );

    if (!actorId) throw new ValidationError('Character is not in combat');

    const result = await this.moveDispatcher.dispatch(
      parsedInput.move,
      actorId,
      parsedInput.targetId,
      { registry: this.ecsRegistry }
    );

    await this.syncCoordinator.syncAllPlayers();
    return result;
  }
}
