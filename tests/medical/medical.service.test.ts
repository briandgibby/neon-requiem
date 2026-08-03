import { MedicalService } from '../../src/domains/medical/medical.service';
import {
  ComponentTypes,
  DeckerComponent,
  HealthComponent,
  ManaComponent,
  PositionComponent,
} from '../../src/engine/ecs/components';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { PlayerRuntime } from '../../src/engine/player-runtime';
import { runtimeCharacter } from '../helpers/runtime-character';

const magicDoctor = {
  className: 'street-doc',
  currentRoomId: 'room-1',
  currentMana: 60,
  streetDocPath: 'magic',
  magic: 5,
  logic: 5,
  inventory: [],
};

describe('MedicalService field treatment', () => {
  it('applies a committed treatment to the live target health pool', async () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter('doc-1', 'account-1', 'Patch', 'street-doc', 100), 'room-1');
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter('target-1', 'account-2', 'Rook', 'mercenary', 30),
      'room-1',
    );
    const commitTreatment = jest.fn(async () => ({
      targetCharacterId: 'target-1',
      targetName: 'Rook',
      targetCurrentHp: 65,
      targetMaxHp: 100,
      actorCurrentMana: 40,
      resourceSpent: 'MANA' as const,
      hpRestored: 35,
    }));
    const medicalRepo = {
      findTreatmentActor: async () => magicDoctor,
      findTreatmentTarget: async () => ({ id: 'target-1', currentHp: 30 }),
      commitTreatment,
    };
    const service = new MedicalService(medicalRepo as never, registry, runtime);

    const result = await service.treat({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetEntityId,
      roomId: 'room-1',
    });

    expect(result).toMatchObject({
      targetCharacterId: 'target-1',
      targetName: 'Rook',
      hpRestored: 35,
      resourceSpent: 'MANA',
    });
    expect(registry.getComponent<HealthComponent>(targetEntityId, ComponentTypes.Health)?.current).toBe(65);
    const doctorEntityId = registry.getEntitiesWith([ComponentTypes.PlayerId])
      .find((entityId) => entityId !== targetEntityId)!;
    expect(registry.getComponent<ManaComponent>(doctorEntityId, ComponentTypes.Mana)?.current).toBe(40);
    expect(commitTreatment).toHaveBeenCalledWith({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetCharacterId: 'target-1',
      roomId: 'room-1',
      expectedCurrentHp: 30,
      targetNextHp: 65,
      hpRestored: 35,
      resource: { type: 'mana', amount: 20 },
    });
  });

  it('preserves combat damage that lands while treatment is being committed', async () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter('doc-1', 'account-1', 'Patch', 'street-doc', 100), 'room-1');
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter('target-1', 'account-2', 'Rook', 'mercenary', 30),
      'room-1',
    );
    const service = new MedicalService({
      findTreatmentActor: async () => magicDoctor,
      findTreatmentTarget: async () => ({ id: 'target-1', currentHp: 30 }),
      commitTreatment: async () => {
        registry.getComponent<HealthComponent>(targetEntityId, ComponentTypes.Health)!.current -= 10;
        return { targetName: 'Rook', actorCurrentMana: 40 };
      },
    } as never, registry, runtime);

    const result = await service.treat({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetEntityId,
      roomId: 'room-1',
    });

    expect(result).toMatchObject({ targetCurrentHp: 55, hpRestored: 35 });
    expect(registry.getComponent<HealthComponent>(targetEntityId, ComponentTypes.Health)?.current).toBe(55);
  });

  it('rolls back only its healing when persistence fails after combat damage', async () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter('doc-1', 'account-1', 'Patch', 'street-doc', 100), 'room-1');
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter('target-1', 'account-2', 'Rook', 'mercenary', 30),
      'room-1',
    );
    const service = new MedicalService({
      findTreatmentActor: async () => magicDoctor,
      findTreatmentTarget: async () => ({ id: 'target-1', currentHp: 30 }),
      commitTreatment: async () => {
        registry.getComponent<HealthComponent>(targetEntityId, ComponentTypes.Health)!.current -= 10;
        throw new Error('database unavailable');
      },
    } as never, registry, runtime);

    await expect(service.treat({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetEntityId,
      roomId: 'room-1',
    })).rejects.toThrow('database unavailable');
    expect(registry.getComponent<HealthComponent>(targetEntityId, ComponentTypes.Health)?.current).toBe(20);
  });

  it('rejects full-health targets before spending a resource', async () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter('doc-1', 'account-1', 'Patch', 'street-doc', 100), 'room-1');
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter('target-1', 'account-2', 'Rook', 'mercenary', 100),
      'room-1',
    );
    const commitTreatment = jest.fn();
    const service = new MedicalService({ commitTreatment } as never, registry, runtime);

    await expect(service.treat({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetEntityId,
      roomId: 'room-1',
    })).rejects.toThrow('Target is already at full health');
    expect(commitTreatment).not.toHaveBeenCalled();
  });

  it('does not allow a Street Doc to treat themself', async () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    const doctorEntityId = runtime.loadCharacter(
      runtimeCharacter('doc-1', 'account-1', 'Patch', 'street-doc', 50),
      'room-1',
    );
    const commitTreatment = jest.fn();
    const service = new MedicalService({ commitTreatment } as never, registry, runtime);

    await expect(service.treat({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetEntityId: doctorEntityId,
      roomId: 'room-1',
    })).rejects.toThrow('A Street Doc cannot treat themself');
    expect(commitTreatment).not.toHaveBeenCalled();
  });

  it('does not revive an incapacitated target through field treatment', async () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter('doc-1', 'account-1', 'Patch', 'street-doc', 100), 'room-1');
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter('target-1', 'account-2', 'Rook', 'mercenary', 0),
      'room-1',
    );
    const commitTreatment = jest.fn();
    const service = new MedicalService({ commitTreatment } as never, registry, runtime);

    await expect(service.treat({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetEntityId,
      roomId: 'room-1',
    })).rejects.toThrow('Field treatment cannot revive an incapacitated target');
    expect(commitTreatment).not.toHaveBeenCalled();
  });

  it('rejects an ally who is no longer in the same live room', async () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter('doc-1', 'account-1', 'Patch', 'street-doc', 100), 'room-1');
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter('target-1', 'account-2', 'Rook', 'mercenary', 30),
      'room-2',
    );
    const commitTreatment = jest.fn();
    const service = new MedicalService({ commitTreatment } as never, registry, runtime);

    await expect(service.treat({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetEntityId,
      roomId: 'room-1',
    })).rejects.toThrow('Doctor and target must be in the same room');
    expect(commitTreatment).not.toHaveBeenCalled();
  });

  it('requires the account-owned actor to be a Street Doc', async () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter('doc-1', 'account-1', 'Patch', 'mercenary', 100), 'room-1');
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter('target-1', 'account-2', 'Rook', 'mercenary', 30),
      'room-1',
    );
    const commitTreatment = jest.fn();
    const service = new MedicalService({
      findTreatmentActor: async () => ({ ...magicDoctor, className: 'mercenary' }),
      findTreatmentTarget: async () => ({ id: 'target-1', currentHp: 30 }),
      commitTreatment,
    } as never, registry, runtime);

    await expect(service.treat({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetEntityId,
      roomId: 'room-1',
    })).rejects.toThrow('Only a Street Doc can perform field treatment');
    expect(commitTreatment).not.toHaveBeenCalled();
  });

  it('rejects a Street Doc whose treatment path is invalid', async () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter('doc-1', 'account-1', 'Patch', 'street-doc', 100), 'room-1');
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter('target-1', 'account-2', 'Rook', 'mercenary', 30),
      'room-1',
    );
    const commitTreatment = jest.fn();
    const service = new MedicalService({
      findTreatmentActor: async () => ({ ...magicDoctor, streetDocPath: null }),
      findTreatmentTarget: async () => ({ id: 'target-1', currentHp: 30 }),
      commitTreatment,
    } as never, registry, runtime);

    await expect(service.treat({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetEntityId,
      roomId: 'room-1',
    })).rejects.toThrow('Street Doc treatment path must be magic or tech');
    expect(commitTreatment).not.toHaveBeenCalled();
  });

  it('uses a jacked-in ally\'s physical room for treatment eligibility', async () => {
    const registry = new EcsRegistry();
    const runtime = new PlayerRuntime(registry);
    runtime.loadCharacter(runtimeCharacter('doc-1', 'account-1', 'Patch', 'street-doc', 100), 'room-1');
    const targetEntityId = runtime.loadCharacter(
      runtimeCharacter('target-1', 'account-2', 'Rook', 'decker', 30),
      'room-1',
    );
    registry.getComponent<PositionComponent>(targetEntityId, ComponentTypes.Position)!.roomId = 'matrix-node-1';
    registry.addComponent<DeckerComponent>(targetEntityId, ComponentTypes.Decker, {
      activeNodeEntityId: 'matrix-node-1',
      physicalRoomId: 'room-1',
      attack: 3,
      sleaze: 3,
      firewall: 3,
      biofeedbackBuffer: 3,
      overwatchScore: 0,
    });
    const commitTreatment = jest.fn(async () => ({
      targetCharacterId: 'target-1',
      targetName: 'Rook',
      targetCurrentHp: 65,
      targetMaxHp: 100,
      actorCurrentMana: 40,
      resourceSpent: 'MANA' as const,
      hpRestored: 35,
    }));
    const service = new MedicalService({
      findTreatmentActor: async () => magicDoctor,
      findTreatmentTarget: async () => ({ id: 'target-1', currentHp: 30 }),
      commitTreatment,
    } as never, registry, runtime);

    await expect(service.treat({
      doctorId: 'doc-1',
      accountId: 'account-1',
      targetEntityId,
      roomId: 'room-1',
    })).resolves.toMatchObject({ targetCharacterId: 'target-1' });
    expect(commitTreatment).toHaveBeenCalledTimes(1);
  });

  it('validates treatment input before reading runtime state', async () => {
    const registry = new EcsRegistry();
    const service = new MedicalService({} as never, registry, new PlayerRuntime(registry));

    await expect(service.treat({} as never)).rejects.toThrow();
  });
});
