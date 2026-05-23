import { CommandDispatcher, CommandOutput } from '../../src/engine/command-dispatcher';
import { CommandRegistry } from '../../src/engine/command-registry';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { ComponentTypes, DeckerComponent, PlayerIdComponent } from '../../src/engine/ecs/components';
import { MoveHandler } from '../../src/engine/commands/move.handler';
import { LookHandler } from '../../src/engine/commands/look.handler';
import { WhoHandler } from '../../src/engine/commands/who.handler';
import { SayHandler } from '../../src/engine/commands/say.handler';
import { TellHandler } from '../../src/engine/commands/tell.handler';
import { HelpHandler } from '../../src/engine/commands/help.handler';
import { JackInHandler } from '../../src/engine/commands/jackin.handler';
import { JackOutHandler } from '../../src/engine/commands/jackout.handler';
import { BruteHandler } from '../../src/engine/commands/brute.handler';
import { SleazeHandler } from '../../src/engine/commands/sleaze.handler';
import { DataSpikeHandler } from '../../src/engine/commands/spike.handler';
import { NavigateHandler } from '../../src/engine/commands/navigate.handler';

function buildMocks() {
  const worldService = {
    getRoom: jest.fn(),
    getPOIs: jest.fn().mockResolvedValue([]),
    moveCharacter: jest.fn(),
    navigate: jest.fn(),
  };
  const socketHub = {
    getSelectedClient: jest.fn().mockReturnValue({
      characterId: 'char-1', accountId: 'acc-1', roomId: 'room-1', characterName: 'Fox',
    }),
    getRoomOccupants: jest.fn().mockReturnValue([]),
    emitToRoom: jest.fn(),
    findSocketForCharacter: jest.fn(),
    sendToSocket: jest.fn(),
  };
  const matrixService = {
    getActiveNode: jest.fn().mockResolvedValue(null),
    jackIn: jest.fn(),
    jackOut: jest.fn(),
    performHacking: jest.fn(),
    dataSpike: jest.fn(),
  };
  const instanceRepo = {
    findInstanceByRoomId: jest.fn().mockResolvedValue(null),
    updateInstanceStatus: jest.fn().mockResolvedValue(undefined),
  };
  const ecsRegistry = new EcsRegistry();
  const output: CommandOutput = {
    emit: jest.fn(),
    data: { characterId: 'char-1', accountId: 'acc-1' },
  };
  return { worldService, socketHub, matrixService, instanceRepo, ecsRegistry, output };
}

function buildDispatcher(overrides: Partial<ReturnType<typeof buildMocks>> = {}) {
  const mocks = { ...buildMocks(), ...overrides };
  const { worldService, socketHub, matrixService, instanceRepo, ecsRegistry } = mocks;

  const registry = new CommandRegistry();
  registry.register(new MoveHandler(worldService as any, socketHub as any, instanceRepo as any));
  registry.register(new NavigateHandler(worldService as any, socketHub as any, instanceRepo as any));
  registry.register(new LookHandler(worldService as any, matrixService as any, socketHub as any));
  registry.register(new WhoHandler(socketHub as any));
  registry.register(new SayHandler(socketHub as any));
  registry.register(new TellHandler(socketHub as any));
  registry.register(new JackInHandler(matrixService as any));
  registry.register(new JackOutHandler(matrixService as any));
  registry.register(new BruteHandler(matrixService as any));
  registry.register(new SleazeHandler(matrixService as any));
  registry.register(new DataSpikeHandler(matrixService as any));
  registry.register(new HelpHandler(registry));

  const dispatcher = new CommandDispatcher(registry, socketHub as any, ecsRegistry);
  return { dispatcher, ...mocks };
}

describe('CommandDispatcher', () => {
  it('handles help command', async () => {
    const { dispatcher, output } = buildDispatcher();
    await dispatcher.dispatch(output, 'help');
    expect(output.emit).toHaveBeenCalledWith('message', expect.objectContaining({
      text: expect.stringContaining('Commands:'),
    }));
  });

  it('handles look command', async () => {
    const mockRoom = { id: 'room-1', name: 'Plaza', zoneId: 'zone-1' };
    const { dispatcher, socketHub, worldService, output } = buildDispatcher();
    socketHub.getSelectedClient.mockReturnValue({ characterId: 'char-1', accountId: 'acc-1', characterName: 'Fox', roomId: 'room-1' });
    worldService.getRoom.mockResolvedValue(mockRoom);
    socketHub.getRoomOccupants.mockReturnValue([]);

    await dispatcher.dispatch(output, 'look');

    expect(output.emit).toHaveBeenCalledWith('room_data', mockRoom);
    expect(output.emit).toHaveBeenCalledWith('room_occupants', []);
  });

  it('handles who command — excludes self', async () => {
    const { dispatcher, socketHub, output } = buildDispatcher();
    socketHub.getSelectedClient.mockReturnValue({ characterId: 'char-1', accountId: 'acc-1', roomId: 'room-1', characterName: 'Fox' });
    socketHub.getRoomOccupants.mockReturnValue([
      { characterId: 'char-1', name: 'Fox' },
      { characterId: 'char-2', name: 'Wraith' },
    ]);

    await dispatcher.dispatch(output, 'who');

    expect(output.emit).toHaveBeenCalledWith('message', expect.objectContaining({
      text: 'Here: Wraith',
    }));
  });

  it('handles say command', async () => {
    const { dispatcher, socketHub, output } = buildDispatcher();
    socketHub.getSelectedClient.mockReturnValue({ characterId: 'char-1', accountId: 'acc-1', characterName: 'Fox', roomId: 'room-1' });

    await dispatcher.dispatch(output, 'say hello world');

    expect(socketHub.emitToRoom).toHaveBeenCalledWith('room-1', 'chat_message', {
      from: 'Fox',
      text: 'hello world',
      scope: 'room',
    });
  });

  it('handles tell command', async () => {
    const { dispatcher, socketHub, output } = buildDispatcher();
    socketHub.getSelectedClient.mockReturnValue({ characterId: 'char-1', accountId: 'acc-1', characterName: 'Fox', roomId: 'room-1' });
    socketHub.findSocketForCharacter.mockReturnValue('socket-target');

    await dispatcher.dispatch(output, 'tell Wraith hello');

    expect(socketHub.sendToSocket).toHaveBeenCalledWith('socket-target', 'chat_message', {
      from: 'Fox',
      text: 'hello',
      scope: 'tell',
    });
    expect(output.emit).toHaveBeenCalledWith('chat_message', {
      from: 'to Wraith',
      text: 'hello',
      scope: 'tell',
    });
  });

  it('handles movement command', async () => {
    const nextRoom = { id: 'room-2', zoneId: 'zone-1', missionInstanceId: null };
    const { dispatcher, worldService, output } = buildDispatcher();
    worldService.moveCharacter.mockResolvedValue({ success: true, room: nextRoom });

    await dispatcher.dispatch(output, 'north');

    expect(worldService.moveCharacter).toHaveBeenCalledWith('char-1', 'acc-1', 'north');
    expect(output.emit).toHaveBeenCalledWith('room_data', nextRoom);
    expect(output.emit).toHaveBeenCalledWith('local_pois', []);
  });

  it('handles multi-word "jack in" normalization', async () => {
    const { dispatcher, matrixService, socketHub, output } = buildDispatcher();
    socketHub.getSelectedClient.mockReturnValue({ characterId: 'char-1', accountId: 'acc-1', characterName: 'Fox', roomId: 'room-1' });
    matrixService.jackIn.mockResolvedValue({ message: 'Jacked in.', node: { id: 'node-1' } });

    await dispatcher.dispatch(output, 'jack in');

    expect(matrixService.jackIn).toHaveBeenCalledWith('char-1', 'acc-1', 'room-1');
  });

  it('handles unknown command', async () => {
    const { dispatcher, output } = buildDispatcher();
    await dispatcher.dispatch(output, 'invalidcommand');
    expect(output.emit).toHaveBeenCalledWith('message', expect.objectContaining({
      text: 'Unknown command: invalidcommand',
    }));
  });
});

describe('CommandDispatcher — body anchoring', () => {
  it('returns an error and does NOT move when the character is jacked in', async () => {
    const { dispatcher, ecsRegistry, worldService, output } = buildDispatcher();

    const entityId = ecsRegistry.createEntity();
    ecsRegistry.addComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId, {
      characterId: 'char-1', accountId: 'acc-1',
    });
    ecsRegistry.addComponent<DeckerComponent>(entityId, ComponentTypes.Decker, {
      activeNodeEntityId: 'node-1',
      physicalRoomId: 'room-1',
      attack: 5, sleaze: 4, firewall: 3, biofeedbackBuffer: 2, overwatchScore: 0,
    });

    await dispatcher.dispatch(output, 'north');

    expect(worldService.moveCharacter).not.toHaveBeenCalled();
    expect(output.emit).toHaveBeenCalledWith('message', expect.objectContaining({
      text: expect.stringContaining('unresponsive'),
    }));
  });

  it('allows movement when the character is NOT jacked in', async () => {
    const { dispatcher, ecsRegistry, worldService, output } = buildDispatcher();
    worldService.moveCharacter.mockResolvedValue({
      success: false, error: 'No exit',
    });

    const entityId = ecsRegistry.createEntity();
    ecsRegistry.addComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId, {
      characterId: 'char-1', accountId: 'acc-1',
    });
    // No DeckerComponent — not jacked in

    await dispatcher.dispatch(output, 'north');

    expect(worldService.moveCharacter).toHaveBeenCalled();
  });
});

describe('CommandDispatcher — instance activation', () => {
  it('activates a PENDING instance when a character enters an instance room', async () => {
    const { dispatcher, worldService, instanceRepo, output } = buildDispatcher();

    worldService.moveCharacter.mockResolvedValue({
      success: true,
      room: { id: 'iroom-1', zoneId: 'zone-1', missionInstanceId: 'inst-1', slug: 'ir-room' },
    });
    instanceRepo.findInstanceByRoomId.mockResolvedValue({ id: 'inst-1', status: 'PENDING' });

    await dispatcher.dispatch(output, 'north');

    expect(instanceRepo.updateInstanceStatus).toHaveBeenCalledWith('inst-1', 'ACTIVE');
  });

  it('does NOT activate when the room has no missionInstanceId', async () => {
    const { dispatcher, worldService, instanceRepo, output } = buildDispatcher();

    worldService.moveCharacter.mockResolvedValue({
      success: true,
      room: { id: 'world-room-1', zoneId: 'zone-1', missionInstanceId: null },
    });

    await dispatcher.dispatch(output, 'north');

    expect(instanceRepo.updateInstanceStatus).not.toHaveBeenCalled();
  });
});
