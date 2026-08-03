import { EcsRegistry } from '../../src/engine/ecs/registry';
import { CombatTickSystem } from '../../src/engine/ecs/systems/combat-tick-system';
import { CombatReinforcementSystem } from '../../src/engine/ecs/systems/combat-reinforcement-system';
import {
  AiComponent,
  ApComponent,
  ComponentTypes,
  CombatSessionComponent,
  CombatStatusComponent,
  MobTemplateComponent,
} from '../../src/engine/ecs/components';
import { COMMAND_AP_PENALTY } from '../../src/shared/constants';

describe('Combat ECS Systems', () => {
  describe('CombatTickSystem', () => {
    it('increments session ticks and decrements reinforcement timers', async () => {
      const registry = new EcsRegistry();
      const tickSystem = new CombatTickSystem(registry);

      const sessionId = registry.createEntity();
      registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId: 'room-1',
        securityRating: 'C',
        alarmState: 'YELLOW',
        turnsUntilReinforcements: 5,
        backupCalled: true,
        tick: 0,
      });

      await tickSystem.onTick(1);

      const session = registry.getComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession);
      expect(session?.tick).toBe(1);
      expect(session?.turnsUntilReinforcements).toBe(4);
    });

    it('processes AP recovery for recovering entities', async () => {
      const registry = new EcsRegistry();
      const tickSystem = new CombatTickSystem(registry);

      const entityId = registry.createEntity();
      registry.addComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus, {
        state: 'recovering',
        isPetActive: false,
      });
      registry.addComponent<ApComponent>(entityId, ComponentTypes.Ap, {
        current: 0,
        max: 6,
        lastRegenAt: 0,
        recoveryTicks: 2,
      });

      await tickSystem.onTick(1);

      let ap = registry.getComponent<ApComponent>(entityId, ComponentTypes.Ap);
      let status = registry.getComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus);

      expect(ap?.recoveryTicks).toBe(1);
      expect(status?.state).toBe('recovering');

      await tickSystem.onTick(2);

      ap = registry.getComponent<ApComponent>(entityId, ComponentTypes.Ap);
      status = registry.getComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus);

      expect(ap?.recoveryTicks).toBe(0);
      expect(status?.state).toBe('engaged');
      expect(ap?.current).toBe(6);
    });
  });

  describe('CombatReinforcementSystem', () => {
    it('spawns reinforcements when timer reaches 0', async () => {
      const registry = new EcsRegistry();
      const mockMobRepo: any = {
        findMobTemplateBySlug: jest.fn().mockResolvedValue({
          name: 'Guard',
          slug: 'security-guard',
          maxHp: 50,
          level: 1,
          body: 5, agility: 5, dexterity: 5, strength: 5,
          logic: 5, intuition: 5, willpower: 5, charisma: 5,
          armorValue: 2, masteryCQC: 2, masteryPistol: 2, masteryRifle: 2, masteryAutomatic: 2
        })
      };

      const system = new CombatReinforcementSystem(registry, mockMobRepo, {
        isEffectiveSafeZone: jest.fn().mockResolvedValue(false),
        getRoom: jest.fn(),
      });

      const sessionId = registry.createEntity();
      registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId: 'room-1',
        securityRating: 'C',
        alarmState: 'YELLOW',
        turnsUntilReinforcements: 0,
        backupCalled: true,
        tick: 10,
      });

      expect(registry.entityCount).toBe(1); // Just the session

      await system.onTick(1);

      expect(registry.entityCount).toBe(2); // Session + 1 Guard
      const session = registry.getComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession);
      expect(session?.turnsUntilReinforcements).toBeNull();
      expect(session?.alarmState).toBe('RED');
      expect(mockMobRepo.findMobTemplateBySlug).toHaveBeenCalledWith('security-guard');
      const spawnedMobId = registry.getEntitiesWith([ComponentTypes.Ai]).find((entityId) => entityId !== sessionId);
      const ai = registry.getComponent<AiComponent>(spawnedMobId!, ComponentTypes.Ai);
      expect(ai?.state).toBe('hostile');
    });

    it('does not spawn reinforcements in effective safe zone', async () => {
      const registry = new EcsRegistry();
      const mockMobRepo: any = {
        findMobTemplateBySlug: jest.fn().mockResolvedValue({
          name: 'Guard',
          slug: 'security-guard',
          maxHp: 50,
          level: 1,
          body: 5, agility: 5, dexterity: 5, strength: 5,
          logic: 5, intuition: 5, willpower: 5, charisma: 5,
          armorValue: 2, masteryCQC: 2, masteryPistol: 2, masteryRifle: 2, masteryAutomatic: 2
        })
      };

      const safeZoneWorldService = { isEffectiveSafeZone: jest.fn().mockResolvedValue(true), getRoom: jest.fn() };
      const system = new CombatReinforcementSystem(registry, mockMobRepo, safeZoneWorldService);

      const sessionId = registry.createEntity();
      registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId: 'safe-room',
        securityRating: 'A',
        alarmState: 'YELLOW',
        turnsUntilReinforcements: 0,
        backupCalled: true,
        tick: 10,
      });

      await system.onTick(1);

      expect(registry.entityCount).toBe(1); // No spawn
      const session = registry.getComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession);
      expect(session?.turnsUntilReinforcements).toBeNull(); // Cleared to avoid retry spam
      expect(mockMobRepo.findMobTemplateBySlug).not.toHaveBeenCalled();
    });

    it('spawns reinforcements when safe zone override is active', async () => {
      const registry = new EcsRegistry();
      const mockMobRepo: any = {
        findMobTemplateBySlug: jest.fn().mockResolvedValue({
          name: 'Guard',
          slug: 'security-guard',
          maxHp: 50,
          level: 1,
          body: 5, agility: 5, dexterity: 5, strength: 5,
          logic: 5, intuition: 5, willpower: 5, charisma: 5,
          armorValue: 2, masteryCQC: 2, masteryPistol: 2, masteryRifle: 2, masteryAutomatic: 2
        })
      };

      const overrideWorldService = { isEffectiveSafeZone: jest.fn().mockResolvedValue(false), getRoom: jest.fn() };
      const system = new CombatReinforcementSystem(registry, mockMobRepo, overrideWorldService);

      const sessionId = registry.createEntity();
      registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId: 'override-room',
        securityRating: 'A',
        alarmState: 'YELLOW',
        turnsUntilReinforcements: 0,
        backupCalled: true,
        tick: 10,
      });

      await system.onTick(1);

      expect(registry.entityCount).toBe(2); // Spawn allowed
      expect(mockMobRepo.findMobTemplateBySlug).toHaveBeenCalledWith('security-guard');
    });

    it('spawns reinforcements in non-safe-zone room', async () => {
      const registry = new EcsRegistry();
      const mockMobRepo: any = {
        findMobTemplateBySlug: jest.fn().mockResolvedValue({
          name: 'Guard',
          slug: 'security-guard',
          maxHp: 50,
          level: 1,
          body: 5, agility: 5, dexterity: 5, strength: 5,
          logic: 5, intuition: 5, willpower: 5, charisma: 5,
          armorValue: 2, masteryCQC: 2, masteryPistol: 2, masteryRifle: 2, masteryAutomatic: 2
        })
      };

      const nonSafeWorldService = { isEffectiveSafeZone: jest.fn().mockResolvedValue(false), getRoom: jest.fn() };
      const system = new CombatReinforcementSystem(registry, mockMobRepo, nonSafeWorldService);

      const sessionId = registry.createEntity();
      registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId: 'back-alley',
        securityRating: 'C',
        alarmState: 'YELLOW',
        turnsUntilReinforcements: 0,
        backupCalled: true,
        tick: 10,
      });

      await system.onTick(1);

      expect(registry.entityCount).toBe(2); // Spawn allowed
      expect(mockMobRepo.findMobTemplateBySlug).toHaveBeenCalledWith('security-guard');
    });

    it('does not retry blocked reinforcement on subsequent ticks', async () => {
      const registry = new EcsRegistry();
      const mockMobRepo: any = {
        findMobTemplateBySlug: jest.fn().mockResolvedValue({
          name: 'Guard',
          slug: 'security-guard',
          maxHp: 50,
          level: 1,
          body: 5, agility: 5, dexterity: 5, strength: 5,
          logic: 5, intuition: 5, willpower: 5, charisma: 5,
          armorValue: 2, masteryCQC: 2, masteryPistol: 2, masteryRifle: 2, masteryAutomatic: 2
        })
      };

      const safeZoneWorldService = { isEffectiveSafeZone: jest.fn().mockResolvedValue(true), getRoom: jest.fn() };
      const system = new CombatReinforcementSystem(registry, mockMobRepo, safeZoneWorldService);

      const sessionId = registry.createEntity();
      registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId: 'safe-room',
        securityRating: 'A',
        alarmState: 'YELLOW',
        turnsUntilReinforcements: 0,
        backupCalled: true,
        tick: 10,
      });

      // First tick - blocked
      await system.onTick(1);
      expect(registry.entityCount).toBe(1);
      expect(mockMobRepo.findMobTemplateBySlug).not.toHaveBeenCalled();

      // Second tick - should still be blocked, no retry
      await system.onTick(2);
      expect(registry.entityCount).toBe(1);
      expect(mockMobRepo.findMobTemplateBySlug).not.toHaveBeenCalled();
      expect(safeZoneWorldService.isEffectiveSafeZone).toHaveBeenCalledTimes(1);

      const session = registry.getComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession);
      expect(session?.turnsUntilReinforcements).toBeNull();
    });

    it('spawns corporation elite reinforcements at RED alert', async () => {
      const registry = new EcsRegistry();
      const mockMobRepo: any = {
        findMobTemplateBySlug: jest.fn().mockResolvedValue({
          name: 'Guard',
          slug: 'security-guard',
          maxHp: 50,
          level: 1,
          body: 5, agility: 5, dexterity: 5, strength: 5,
          logic: 5, intuition: 5, willpower: 5, charisma: 5,
          armorValue: 2, masteryCQC: 2, masteryPistol: 2, masteryRifle: 2, masteryAutomatic: 2,
        }),
        findEliteMobTemplateByCorporation: jest.fn().mockResolvedValue({
          name: 'Red Samurai',
          slug: 'red-samurai',
          maxHp: 120,
          level: 8,
          body: 10, agility: 10, dexterity: 10, strength: 10,
          logic: 6, intuition: 8, willpower: 8, charisma: 4,
          armorValue: 8, masteryCQC: 8, masteryPistol: 6, masteryRifle: 8, masteryAutomatic: 8,
          eliteOnly: true,
          corporationId: 'renraku',
        }),
      };
      const worldPolicy = {
        isEffectiveSafeZone: jest.fn().mockResolvedValue(false),
        getRoom: jest.fn().mockResolvedValue({
          id: 'room-1',
          slug: 'renraku-lab',
          exits: {},
          factionOwner: 'renraku',
        }),
      };
      const system = new CombatReinforcementSystem(registry, mockMobRepo, worldPolicy);

      const sessionId = registry.createEntity();
      registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId: 'room-1',
        securityRating: 'A',
        alarmState: 'RED',
        turnsUntilReinforcements: 0,
        backupCalled: true,
        tick: 10,
      });

      await system.onTick(1);

      const templateSlugs = registry.getEntitiesWith([ComponentTypes.MobTemplate])
        .map((entityId) => registry.getComponent<MobTemplateComponent>(entityId, ComponentTypes.MobTemplate)?.templateSlug);
      expect(templateSlugs).toEqual(expect.arrayContaining(['security-guard', 'red-samurai']));
      expect(mockMobRepo.findEliteMobTemplateByCorporation).toHaveBeenCalledWith('renraku');
    });

    it('does not spawn elite reinforcements before RED alert', async () => {
      const registry = new EcsRegistry();
      const mockMobRepo: any = {
        findMobTemplateBySlug: jest.fn().mockResolvedValue({
          name: 'Guard',
          slug: 'security-guard',
          maxHp: 50,
          level: 1,
          body: 5, agility: 5, dexterity: 5, strength: 5,
          logic: 5, intuition: 5, willpower: 5, charisma: 5,
          armorValue: 2, masteryCQC: 2, masteryPistol: 2, masteryRifle: 2, masteryAutomatic: 2,
        }),
        findEliteMobTemplateByCorporation: jest.fn(),
      };
      const worldPolicy = {
        isEffectiveSafeZone: jest.fn().mockResolvedValue(false),
        getRoom: jest.fn().mockResolvedValue({
          id: 'room-1',
          slug: 'renraku-lab',
          exits: {},
          factionOwner: 'renraku',
        }),
      };
      const system = new CombatReinforcementSystem(registry, mockMobRepo, worldPolicy);

      const sessionId = registry.createEntity();
      registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId: 'room-1',
        securityRating: 'A',
        alarmState: 'YELLOW',
        turnsUntilReinforcements: 0,
        backupCalled: true,
        tick: 10,
      });

      await system.onTick(1);

      expect(mockMobRepo.findEliteMobTemplateByCorporation).not.toHaveBeenCalled();
    });

    it('does not spawn elite reinforcements when ordinary security guard template is missing', async () => {
      const registry = new EcsRegistry();
      const mockMobRepo: any = {
        findMobTemplateBySlug: jest.fn().mockResolvedValue(null),
        findEliteMobTemplateByCorporation: jest.fn(),
      };
      const worldPolicy = {
        isEffectiveSafeZone: jest.fn().mockResolvedValue(false),
        getRoom: jest.fn().mockResolvedValue({
          id: 'room-1',
          slug: 'renraku-lab',
          exits: {},
          factionOwner: 'renraku',
        }),
      };
      const system = new CombatReinforcementSystem(registry, mockMobRepo, worldPolicy);

      const sessionId = registry.createEntity();
      registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId: 'room-1',
        securityRating: 'A',
        alarmState: 'RED',
        turnsUntilReinforcements: 0,
        backupCalled: true,
        tick: 10,
      });

      await system.onTick(1);

      expect(registry.entityCount).toBe(1);
      expect(mockMobRepo.findEliteMobTemplateByCorporation).not.toHaveBeenCalled();
    });

    it('surfaces room ownership lookup failures for RED elite spawns', async () => {
      const registry = new EcsRegistry();
      const mockMobRepo: any = {
        findMobTemplateBySlug: jest.fn().mockResolvedValue({
          name: 'Guard',
          slug: 'security-guard',
          maxHp: 50,
          level: 1,
          body: 5, agility: 5, dexterity: 5, strength: 5,
          logic: 5, intuition: 5, willpower: 5, charisma: 5,
          armorValue: 2, masteryCQC: 2, masteryPistol: 2, masteryRifle: 2, masteryAutomatic: 2,
        }),
        findEliteMobTemplateByCorporation: jest.fn(),
      };
      const worldPolicy = {
        isEffectiveSafeZone: jest.fn().mockResolvedValue(false),
        getRoom: jest.fn().mockRejectedValue(new Error('room lookup failed')),
      };
      const system = new CombatReinforcementSystem(registry, mockMobRepo, worldPolicy);

      const sessionId = registry.createEntity();
      registry.addComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession, {
        roomId: 'room-1',
        securityRating: 'A',
        alarmState: 'RED',
        turnsUntilReinforcements: 0,
        backupCalled: true,
        tick: 10,
      });

      await expect(system.onTick(1)).rejects.toThrow('room lookup failed');
      expect(mockMobRepo.findEliteMobTemplateByCorporation).not.toHaveBeenCalled();
    });
  });
});
