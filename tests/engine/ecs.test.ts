import { EcsRegistry } from '../../src/engine/ecs/registry';
import { ComponentTypes, HealthComponent } from '../../src/engine/ecs/components';
import { RegenSystem } from '../../src/engine/ecs/systems/regen-system';
import { MobFactory } from '../../src/engine/ecs/factories/mob-factory';

describe('ECS Foundation', () => {
  describe('EcsRegistry', () => {
    it('creates and destroys entities', () => {
      const registry = new EcsRegistry();
      const e1 = registry.createEntity();
      const e2 = registry.createEntity();
      
      expect(registry.entityCount).toBe(2);
      
      registry.destroyEntity(e1);
      expect(registry.entityCount).toBe(1);
    });

    it('adds and retrieves components', () => {
      const registry = new EcsRegistry();
      const e1 = registry.createEntity();
      const data = { name: 'Test' };
      
      registry.addComponent(e1, 'identity', data);
      expect(registry.getComponent(e1, 'identity')).toBe(data);
    });

    it('queries entities with specific components', () => {
      const registry = new EcsRegistry();
      const e1 = registry.createEntity();
      const e2 = registry.createEntity();
      
      registry.addComponent(e1, 'c1', {});
      registry.addComponent(e1, 'c2', {});
      registry.addComponent(e2, 'c1', {});
      
      expect(registry.getEntitiesWith(['c1'])).toContain(e1);
      expect(registry.getEntitiesWith(['c1'])).toContain(e2);
      expect(registry.getEntitiesWith(['c1', 'c2'])).toEqual([e1]);
      expect(registry.getEntitiesWith(['c3'])).toEqual([]);
    });
  });

  describe('RegenSystem', () => {
    it('regenerates health over time', async () => {
      const registry = new EcsRegistry();
      const system = new RegenSystem(registry);
      
      const e1 = registry.createEntity();
      registry.addComponent<HealthComponent>(e1, ComponentTypes.Health, {
        current: 50,
        max: 100,
        lastRegenAt: 0
      });
      
      await system.onTick(10); // Frequency is 10
      
      const health = registry.getComponent<HealthComponent>(e1, ComponentTypes.Health);
      expect(health?.current).toBe(51);
    });

    it('does not exceed max health', async () => {
      const registry = new EcsRegistry();
      const system = new RegenSystem(registry);
      
      const e1 = registry.createEntity();
      registry.addComponent<HealthComponent>(e1, ComponentTypes.Health, {
        current: 100,
        max: 100,
        lastRegenAt: 0
      });
      
      await system.onTick(10);
      
      const health = registry.getComponent<HealthComponent>(e1, ComponentTypes.Health);
      expect(health?.current).toBe(100);
    });
  });

  describe('MobFactory', () => {
    it('creates a complete entity from template', () => {
      const registry = new EcsRegistry();
      const template: any = {
        name: 'Gutter Punk',
        slug: 'gutter-punk',
        level: 1,
        maxHp: 40,
        body: 3,
        agility: 3,
        dexterity: 3,
        strength: 3,
        armorValue: 2,
        masteryCQC: 2,
        masteryPistol: 1,
        masteryRifle: 0,
        masteryAutomatic: 0
      };
      
      const entityId = MobFactory.createFromTemplate(registry, template, 'room-1');
      
      expect(registry.getComponent(entityId, ComponentTypes.Identity)).toBeDefined();
      expect(registry.getComponent(entityId, ComponentTypes.Health)).toMatchObject({ current: 40, max: 40 });
      expect(registry.getComponent(entityId, ComponentTypes.Stun)).toBeDefined();
      expect(registry.getComponent(entityId, ComponentTypes.Ap)).toBeDefined();
      expect(registry.getComponent(entityId, ComponentTypes.Attributes)).toBeDefined();
      expect(registry.getComponent(entityId, ComponentTypes.Skills)).toBeDefined();
      expect(registry.getComponent(entityId, ComponentTypes.Position)).toMatchObject({ roomId: 'room-1' });
      expect(registry.getComponent(entityId, ComponentTypes.Ai)).toMatchObject({ state: 'idle' });
    });
  });
});
