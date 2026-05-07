import { EcsRegistry } from '../../src/engine/ecs/registry';
import { CombatTickSystem } from '../../src/engine/ecs/systems/combat-tick-system';
import { CombatReinforcementSystem } from '../../src/engine/ecs/systems/combat-reinforcement-system';
import { ComponentTypes, CombatSessionComponent, CombatStatusComponent, ApComponent } from '../../src/engine/ecs/components';
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
        findBySlug: jest.fn().mockResolvedValue({
          name: 'Guard',
          slug: 'security-guard',
          maxHp: 50,
          level: 1,
          body: 5, agility: 5, dexterity: 5, strength: 5,
          logic: 5, intuition: 5, willpower: 5, charisma: 5,
          armorValue: 2, masteryCQC: 2, masteryPistol: 2, masteryRifle: 2, masteryAutomatic: 2
        })
      };

      const system = new CombatReinforcementSystem(registry, mockMobRepo);

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
      expect(mockMobRepo.findBySlug).toHaveBeenCalledWith('security-guard');
    });
  });
});
