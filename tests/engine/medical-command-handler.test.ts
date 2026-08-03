import { MedicalService } from '../../src/domains/medical/medical.service';
import { CommandDispatcher, CommandOutput } from '../../src/engine/command-dispatcher';
import { CommandRegistry } from '../../src/engine/command-registry';
import { TreatHandler } from '../../src/engine/commands/treat.handler';
import { ComponentTypes, HealthComponent } from '../../src/engine/ecs/components';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { PlayerRuntime } from '../../src/engine/player-runtime';
import { runtimeCharacter } from '../helpers/runtime-character';

describe('Treat command', () => {
  it('dispatches an injured-ally picker value through treatment and publishes the result', async () => {
    const ecsRegistry = new EcsRegistry();
    const playerRuntime = new PlayerRuntime(ecsRegistry);
    playerRuntime.loadCharacter(runtimeCharacter('doc-1', 'account-1', 'Patch', 'street-doc', 100), 'room-1');
    const targetEntityId = playerRuntime.loadCharacter(
      runtimeCharacter('target-1', 'account-2', 'Rook', 'mercenary', 30),
      'room-1',
    );
    const medicalRepo = {
      findTreatmentActor: async () => ({
        className: 'street-doc',
        currentRoomId: 'room-1',
        currentMana: 60,
        streetDocPath: 'tech',
        magic: null,
        logic: 5,
        inventory: [{
          id: 'supply-1',
          quantity: 1,
          item: { slug: 'medical-supplies' },
        }],
      }),
      findTreatmentTarget: async () => ({ id: 'target-1', currentHp: 30 }),
      commitTreatment: async () => ({
        targetCharacterId: 'target-1',
        targetName: 'Rook',
        targetCurrentHp: 65,
        targetMaxHp: 100,
        actorCurrentMana: 60,
        resourceSpent: 'SUPPLIES' as const,
        hpRestored: 35,
      }),
    };
    const medicalService = new MedicalService(medicalRepo as never, ecsRegistry, playerRuntime);
    const roomEvents = { publish: jest.fn() };
    const characterUpdates = { publish: jest.fn() };
    const combatService = {
      listTargets: jest.fn().mockResolvedValue({ hostiles: [], allies: [] }),
    };
    const handler = new TreatHandler(
      medicalService,
      combatService as never,
      roomEvents,
      characterUpdates,
    );
    const registry = new CommandRegistry();
    registry.register(handler);
    const socketHub = {
      getSelectedClient: () => ({
        characterId: 'doc-1',
        accountId: 'account-1',
        roomId: 'room-1',
        characterName: 'Patch',
      }),
    };
    const dispatcher = new CommandDispatcher(registry, socketHub as never, ecsRegistry);
    const output: CommandOutput = {
      emit: jest.fn(),
      data: { characterId: 'doc-1', accountId: 'account-1' },
    };

    await dispatcher.dispatch(output, `treat ${targetEntityId}`);

    expect(handler.argumentSource).toBe('injured-ally');
    expect(ecsRegistry.getComponent<HealthComponent>(targetEntityId, ComponentTypes.Health)?.current).toBe(65);
    expect(roomEvents.publish).toHaveBeenCalledWith('room-1', {
      text: 'Patch treats Rook for 35 HP using Medical Supplies.',
      type: 'info',
    });
    expect(characterUpdates.publish).toHaveBeenCalledWith('target-1', {
      currentHp: 65,
      maxHp: 100,
    });
    expect(output.emit).toHaveBeenCalledWith('combat_targets', { hostiles: [], allies: [] });
  });
});
