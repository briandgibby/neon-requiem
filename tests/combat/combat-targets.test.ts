import { CombatService } from '../../src/domains/combat/combat.service';
import { ComponentTypes } from '../../src/engine/ecs/components';
import { MobFactory } from '../../src/engine/ecs/factories/mob-factory';
import { EcsRegistry } from '../../src/engine/ecs/registry';

const MOB_TEMPLATE = {
  id: 'template-1',
  slug: 'redmond-enforcer',
  name: 'Redmond Enforcer',
  level: 2,
  maxHp: 40,
  body: 4,
  agility: 4,
  dexterity: 3,
  strength: 4,
  logic: 2,
  intuition: 3,
  willpower: 3,
  charisma: 2,
  masteryCQC: 3,
  masteryPistol: 1,
  masteryRifle: 0,
  masteryAutomatic: 0,
  armorValue: 2,
} as any;

describe('CombatService target catalog', () => {
  it('lists only living physical NPCs in the selected Character room', async () => {
    const registry = new EcsRegistry();
    const visibleId = MobFactory.createFromTemplate(registry, MOB_TEMPLATE, 'room-1', 'hostile');
    const defeatedId = MobFactory.createFromTemplate(registry, MOB_TEMPLATE, 'room-1', 'hostile');
    MobFactory.createFromTemplate(registry, MOB_TEMPLATE, 'room-2', 'hostile');
    registry.getComponent<any>(defeatedId, ComponentTypes.Health)!.current = 0;

    const service = new CombatService(
      {} as any,
      { findByIdAndAccount: jest.fn().mockResolvedValue({ id: 'char-1', currentRoomId: 'room-1' }) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      registry,
      {} as any,
      {} as any,
    );

    await expect(service.listTargets('char-1', 'account-1')).resolves.toEqual({
      hostiles: [
        {
          id: visibleId,
          name: 'Redmond Enforcer',
          currentHp: 40,
          maxHp: 40,
        },
      ],
      allies: [],
    });
  });
});
