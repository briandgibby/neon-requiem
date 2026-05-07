import { CombatRepository } from './combat.repository';
import { CharacterRepository } from '../character/character.repository';
import { WorldRepository } from '../world/world.repository';
import { MobRepository } from './mob.repository';
import { MagicService } from '../magic/magic.service';
import { MatrixService } from '../matrix/matrix.service';
import { MoveInput } from './combat.types';
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
  IdentityComponent, 
  PositionComponent, 
  HealthComponent, 
  StunComponent, 
  ManaComponent, 
  ApComponent, 
  AttributesComponent, 
  SkillsComponent,
  PlayerIdComponent,
} from '../../engine/ecs/components';

export class CombatService implements Tickable {
  readonly name = 'CombatService';
  readonly frequency = 1; // Process combat every tick

  constructor(
    private readonly combatRepo: CombatRepository,
    private readonly charRepo: CharacterRepository,
    private readonly worldRepo: WorldRepository,
    private readonly mobRepo: MobRepository,
    private readonly magicService: MagicService,
    private readonly matrixService: MatrixService,
    private readonly ecsRegistry: EcsRegistry,
    private readonly moveDispatcher: MoveDispatcher,
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    // ECS Systems now handle the simulation tick independently.
    // We only need to sync state to DB if we want periodic persistence.
    if (_tickCount % 10 === 0) {
      await this.syncEcsToDb();
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

    entityId = this.ecsRegistry.createEntity();
    
    this.ecsRegistry.addComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId, {
      characterId,
      accountId,
    });

    this.ecsRegistry.addComponent<IdentityComponent>(entityId, ComponentTypes.Identity, {
      name: character.name,
      slug: character.name.toLowerCase().replace(/\s+/g, '-'),
    });

    this.ecsRegistry.addComponent<PositionComponent>(entityId, ComponentTypes.Position, {
      roomId,
    });

    const now = Date.now();
    this.ecsRegistry.addComponent<HealthComponent>(entityId, ComponentTypes.Health, {
      current: character.currentHp,
      max: character.maxHp,
      lastRegenAt: now,
    });

    this.ecsRegistry.addComponent<StunComponent>(entityId, ComponentTypes.Stun, {
      current: character.currentStun,
      max: character.maxStun,
      lastRegenAt: now,
    });

    this.ecsRegistry.addComponent<ManaComponent>(entityId, ComponentTypes.Mana, {
      current: character.currentMana,
      max: character.maxMana,
      lastRegenAt: now,
    });

    this.ecsRegistry.addComponent<ApComponent>(entityId, ComponentTypes.Ap, {
      current: MAX_AP,
      max: MAX_AP,
      lastRegenAt: now,
      recoveryTicks: 0,
    });

    this.ecsRegistry.addComponent<AttributesComponent>(entityId, ComponentTypes.Attributes, {
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
    });

    this.ecsRegistry.addComponent<SkillsComponent>(entityId, ComponentTypes.Skills, {
      masteryCQC: character.masteryCQC,
      masteryPistol: character.masteryPistol,
      masteryRifle: character.masteryRifle,
      masteryAutomatic: character.masteryAutomatic,
      armorValue: character.armorValue,
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

    await this.syncEcsToDb();
    return result;
  }

  private async syncEcsToDb() {
    const playerEntities = this.ecsRegistry.getEntitiesWith([ComponentTypes.PlayerId]);
    for (const entityId of playerEntities) {
      const playerId = this.ecsRegistry.getComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId);
      const health = this.ecsRegistry.getComponent<HealthComponent>(entityId, ComponentTypes.Health);
      const stun = this.ecsRegistry.getComponent<StunComponent>(entityId, ComponentTypes.Stun);
      const mana = this.ecsRegistry.getComponent<ManaComponent>(entityId, ComponentTypes.Mana);

      if (playerId && health && stun && mana) {
        await this.charRepo.updateCharacter(playerId.characterId, {
          currentHp: health.current,
          currentStun: stun.current,
          currentMana: mana.current,
        });
      }
    }
  }
}
