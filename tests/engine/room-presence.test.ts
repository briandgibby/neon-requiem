import { RoomPresence } from '../../src/engine/room-presence';

describe('RoomPresence', () => {
  it('tracks selected characters as room occupants without leaking socket data', () => {
    const presence = new RoomPresence();

    presence.setCharacter({
      socketId: 'socket-1',
      accountId: 'account-1',
      username: 'runner',
      characterId: 'char-1',
      characterName: 'Chrome Fox',
      roomId: 'room-a',
    });

    expect(presence.getRoomOccupants('room-a')).toEqual([
      { characterId: 'char-1', name: 'Chrome Fox' },
    ]);
  });

  it('moves selected characters between rooms and updates both occupant lists', () => {
    const presence = new RoomPresence();
    presence.setCharacter({
      socketId: 'socket-1',
      accountId: 'account-1',
      username: 'runner',
      characterId: 'char-1',
      characterName: 'Chrome Fox',
      roomId: 'room-a',
    });

    const move = presence.moveCharacter('socket-1', 'room-b');

    expect(move).toEqual({
      socketId: 'socket-1',
      characterId: 'char-1',
      characterName: 'Chrome Fox',
      previousRoomId: 'room-a',
      nextRoomId: 'room-b',
    });
    expect(presence.getRoomOccupants('room-a')).toEqual([]);
    expect(presence.getRoomOccupants('room-b')).toEqual([
      { characterId: 'char-1', name: 'Chrome Fox' },
    ]);
  });

  it('removes a selected character from room occupants on disconnect', () => {
    const presence = new RoomPresence();
    presence.setCharacter({
      socketId: 'socket-1',
      accountId: 'account-1',
      username: 'runner',
      characterId: 'char-1',
      characterName: 'Chrome Fox',
      roomId: 'room-a',
    });

    const removed = presence.removeSocket('socket-1');

    expect(removed).toEqual({
      socketId: 'socket-1',
      characterId: 'char-1',
      characterName: 'Chrome Fox',
      previousRoomId: 'room-a',
    });
    expect(presence.getRoomOccupants('room-a')).toEqual([]);
  });

  it('replaces an account previous selected character when the same account reconnects', () => {
    const presence = new RoomPresence();
    presence.setCharacter({
      socketId: 'socket-1',
      accountId: 'account-1',
      username: 'runner',
      characterId: 'char-1',
      characterName: 'Chrome Fox',
      roomId: 'room-a',
    });

    presence.setCharacter({
      socketId: 'socket-2',
      accountId: 'account-1',
      username: 'runner',
      characterId: 'char-2',
      characterName: 'Neon Wraith',
      roomId: 'room-b',
    });

    expect(presence.getRoomOccupants('room-a')).toEqual([]);
    expect(presence.getRoomOccupants('room-b')).toEqual([
      { characterId: 'char-2', name: 'Neon Wraith' },
    ]);
  });
});

describe('RoomPresence events', () => {
  it('emits character_joined when a character is set', () => {
    const presence = new RoomPresence();
    const joined = jest.fn();
    presence.on('character_joined', joined);

    presence.setCharacter({
      socketId: 'socket-1', accountId: 'acc-1', username: 'runner',
      characterId: 'char-1', characterName: 'Chrome Fox', roomId: 'room-a',
    });

    expect(joined).toHaveBeenCalledWith(expect.objectContaining({ characterId: 'char-1' }));
  });

  it('emits character_left for the evicted session when the same account reconnects', () => {
    const presence = new RoomPresence();
    const left = jest.fn();
    presence.on('character_left', left);

    presence.setCharacter({
      socketId: 'socket-1', accountId: 'acc-1', username: 'runner',
      characterId: 'char-1', characterName: 'Chrome Fox', roomId: 'room-a',
    });
    presence.setCharacter({
      socketId: 'socket-2', accountId: 'acc-1', username: 'runner',
      characterId: 'char-2', characterName: 'Neon Wraith', roomId: 'room-b',
    });

    expect(left).toHaveBeenCalledWith(expect.objectContaining({ characterId: 'char-1' }));
  });

  it('emits character_moved when a character moves rooms', () => {
    const presence = new RoomPresence();
    presence.setCharacter({
      socketId: 'socket-1', accountId: 'acc-1', username: 'runner',
      characterId: 'char-1', characterName: 'Chrome Fox', roomId: 'room-a',
    });
    const moved = jest.fn();
    presence.on('character_moved', moved);

    presence.moveCharacter('socket-1', 'room-b');

    expect(moved).toHaveBeenCalledWith(expect.objectContaining({
      characterId: 'char-1',
      previousRoomId: 'room-a',
      nextRoomId: 'room-b',
    }));
  });

  it('emits character_left when a socket is removed', () => {
    const presence = new RoomPresence();
    presence.setCharacter({
      socketId: 'socket-1', accountId: 'acc-1', username: 'runner',
      characterId: 'char-1', characterName: 'Chrome Fox', roomId: 'room-a',
    });
    const left = jest.fn();
    presence.on('character_left', left);

    presence.removeSocket('socket-1');

    expect(left).toHaveBeenCalledWith(expect.objectContaining({
      characterId: 'char-1',
      previousRoomId: 'room-a',
    }));
  });
});
