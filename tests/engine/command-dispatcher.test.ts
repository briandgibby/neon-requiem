import { CommandDispatcher, CommandOutput } from '../../src/engine/command-dispatcher';
import { EcsRegistry } from '../../src/engine/ecs/registry';
import { ComponentTypes, DeckerComponent, PlayerIdComponent } from '../../src/engine/ecs/components';

describe('CommandDispatcher', () => {
  let dispatcher: CommandDispatcher;
  let mockWorldService: any;
  let mockSocketHub: any;
  let mockMatrixService: any;
  let mockOutput: CommandOutput;

  beforeEach(() => {
    mockWorldService = {
      getRoom: jest.fn(),
      getPOIs: jest.fn(),
      moveCharacter: jest.fn(),
      navigate: jest.fn(),
    };
    mockSocketHub = {
      getSelectedClient: jest.fn(),
      getRoomOccupants: jest.fn().mockReturnValue([]),
      emitToRoom: jest.fn(),
      findSocketForCharacter: jest.fn(),
      sendToSocket: jest.fn(),
    };
    mockMatrixService = {
      getActiveNode: jest.fn().mockResolvedValue(null),
      jackIn: jest.fn(),
      jackOut: jest.fn(),
      performHacking: jest.fn(),
      dataSpike: jest.fn(),
    };
    mockOutput = {
      emit: jest.fn(),
      data: {
        characterId: 'char-1',
        accountId: 'acc-1',
      },
    };
    dispatcher = new CommandDispatcher(mockWorldService, mockSocketHub, mockMatrixService);
  });

  it('handles help command', async () => {
    await dispatcher.dispatch(mockOutput, 'help');
    expect(mockOutput.emit).toHaveBeenCalledWith('message', expect.objectContaining({
      text: expect.stringContaining('Commands:'),
      type: 'info',
    }));
  });

  it('handles look command', async () => {
    const mockRoom = { id: 'room-1', name: 'Plaza', zoneId: 'zone-1' };
    mockSocketHub.getSelectedClient.mockReturnValue({ characterId: 'char-1', characterName: 'Fox', roomId: 'room-1' });
    mockWorldService.getRoom.mockResolvedValue(mockRoom);
    mockSocketHub.getRoomOccupants.mockReturnValue([]);

    await dispatcher.dispatch(mockOutput, 'look');

    expect(mockOutput.emit).toHaveBeenCalledWith('room_data', mockRoom);
    expect(mockOutput.emit).toHaveBeenCalledWith('room_occupants', []);
  });

  it('handles who command', async () => {
    mockSocketHub.getSelectedClient.mockReturnValue({ roomId: 'room-1' });
    mockSocketHub.getRoomOccupants.mockReturnValue([
      { characterId: 'char-1', name: 'Fox' },
      { characterId: 'char-2', name: 'Wraith' }
    ]);

    await dispatcher.dispatch(mockOutput, 'who');

    expect(mockOutput.emit).toHaveBeenCalledWith('message', expect.objectContaining({
      text: 'Here: Fox, Wraith',
    }));
  });

  it('handles say command', async () => {
    mockSocketHub.getSelectedClient.mockReturnValue({ characterName: 'Fox', roomId: 'room-1' });

    await dispatcher.dispatch(mockOutput, 'say hello world');

    expect(mockSocketHub.emitToRoom).toHaveBeenCalledWith('room-1', 'chat_message', {
      from: 'Fox',
      text: 'hello world',
      scope: 'room',
    });
  });

  it('handles tell command', async () => {
    mockSocketHub.getSelectedClient.mockReturnValue({ characterName: 'Fox' });
    mockSocketHub.findSocketForCharacter.mockReturnValue('socket-target');

    await dispatcher.dispatch(mockOutput, 'tell Wraith hello');

    expect(mockSocketHub.sendToSocket).toHaveBeenCalledWith('socket-target', 'chat_message', {
      from: 'Fox',
      text: 'hello',
      scope: 'tell',
    });
    expect(mockOutput.emit).toHaveBeenCalledWith('chat_message', {
      from: 'to Wraith',
      text: 'hello',
      scope: 'tell',
    });
  });

  it('handles movement command', async () => {
    const nextRoom = { id: 'room-2', zoneId: 'zone-1' };
    mockWorldService.moveCharacter.mockResolvedValue({ success: true, room: nextRoom });
    mockWorldService.getPOIs.mockResolvedValue([]);

    await dispatcher.dispatch(mockOutput, 'north');

    expect(mockWorldService.moveCharacter).toHaveBeenCalledWith('char-1', 'acc-1', 'north');
    expect(mockOutput.emit).toHaveBeenCalledWith('room_data', nextRoom);
    expect(mockOutput.emit).toHaveBeenCalledWith('local_pois', []);
  });

  it('handles unknown command', async () => {
    await dispatcher.dispatch(mockOutput, 'invalidcommand');
    expect(mockOutput.emit).toHaveBeenCalledWith('message', expect.objectContaining({
      text: 'Unknown command: invalidcommand',
    }));
  });
});

describe('CommandDispatcher — body anchoring', () => {
  function buildEnv() {
    const registry = new EcsRegistry();
    const worldService = {
      moveCharacter: jest.fn(),
      navigate: jest.fn(),
      getRoom: jest.fn(),
      getPOIs: jest.fn().mockResolvedValue([]),
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
    const matrixService = { getActiveNode: jest.fn().mockResolvedValue(null) };
    const output = {
      emit: jest.fn(),
      data: { characterId: 'char-1', accountId: 'acc-1' },
    };

    const dispatcher = new CommandDispatcher(
      worldService as any, socketHub as any, matrixService as any, registry
    );
    return { dispatcher, registry, worldService, output };
  }

  it('returns an error and does NOT move when the character is jacked in', async () => {
    const { dispatcher, registry, worldService, output } = buildEnv();

    const entityId = registry.createEntity();
    registry.addComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId, {
      characterId: 'char-1', accountId: 'acc-1',
    });
    registry.addComponent<DeckerComponent>(entityId, ComponentTypes.Decker, {
      activeNodeEntityId: 'node-1',
      physicalRoomId: 'room-1',
      attack: 5, sleaze: 4, firewall: 3, biofeedbackBuffer: 2, overwatchScore: 0,
    });

    await dispatcher.dispatch(output as any, 'north');

    expect(worldService.moveCharacter).not.toHaveBeenCalled();
    expect(output.emit).toHaveBeenCalledWith('message', expect.objectContaining({
      text: expect.stringContaining('unresponsive'),
    }));
  });

  it('allows movement when the character is NOT jacked in', async () => {
    const { dispatcher, registry, worldService, output } = buildEnv();

    worldService.moveCharacter.mockResolvedValue({ success: false, error: 'No exit' });

    const entityId = registry.createEntity();
    registry.addComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId, {
      characterId: 'char-1', accountId: 'acc-1',
    });
    // No DeckerComponent — not jacked in

    await dispatcher.dispatch(output as any, 'north');

    expect(worldService.moveCharacter).toHaveBeenCalled();
  });
});
