import { EcsRegistry } from '../../src/engine/ecs/registry';
import { MoveDispatcher } from '../../src/engine/ecs/combat/move-dispatcher';
import { AttackExecutor } from '../../src/engine/ecs/combat/moves/attack-executor';
import { ComponentTypes, HealthComponent, ApComponent } from '../../src/engine/ecs/components';
import { MobFactory } from '../../src/engine/ecs/factories/mob-factory';

describe('Combat ECS', () => {
  let registry: EcsRegistry;
  let dispatcher: MoveDispatcher;

  beforeEach(() => {
    registry = new EcsRegistry();
    dispatcher = new MoveDispatcher();
    dispatcher.register(new AttackExecutor());
  });

  it('executes an attack and deducts AP', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5); // Ensure consistent hit resolution
    
    // Create two mobs
    const template: any = {
      name: 'Mob', slug: 'mob', level: 1, maxHp: 100, 
      body: 5, agility: 5, dexterity: 5, strength: 5,
      armorValue: 0, masteryCQC: 5, masteryPistol: 0, masteryRifle: 0, masteryAutomatic: 0
    };
    
    const actorId = MobFactory.createFromTemplate(registry, template, 'room-1');
    const targetId = MobFactory.createFromTemplate(registry, template, 'room-1');

    // Rig the target to be easy to hit
    const targetAttrs = registry.getComponent<any>(targetId, ComponentTypes.Attributes);
    targetAttrs.agility = 0;
    targetAttrs.intuition = 0;

    const context = { registry };
    const result = await dispatcher.dispatch('attack', actorId, targetId, context);
    console.log('Attack Result:', result);

    expect(result.success).toBe(true);
    expect(result.message).toContain('You attack');

    const ap = registry.getComponent<ApComponent>(actorId, ComponentTypes.Ap);
    expect(ap?.current).toBe(6 - 4); // MAX_AP (6) - Cost (4)

    const health = registry.getComponent<HealthComponent>(targetId, ComponentTypes.Health);
    expect(health?.current).toBeLessThan(100);
  });

  it('fails if not enough AP', async () => {
    const template: any = {
      name: 'Mob', slug: 'mob', level: 1, maxHp: 100, 
      body: 5, agility: 5, dexterity: 5, strength: 5,
      armorValue: 0, masteryCQC: 5, masteryPistol: 0, masteryRifle: 0, masteryAutomatic: 0
    };
    
    const actorId = MobFactory.createFromTemplate(registry, template, 'room-1');
    const targetId = MobFactory.createFromTemplate(registry, template, 'room-1');

    const ap = registry.getComponent<ApComponent>(actorId, ComponentTypes.Ap);
    ap!.current = 2; // Not enough for attack (4)

    const context = { registry };
    await expect(dispatcher.dispatch('attack', actorId, targetId, context))
      .rejects.toThrow('Not enough Action Points');
  });
});
