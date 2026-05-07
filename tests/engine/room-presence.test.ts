import { RoomPresence } from '../../src/engine/room-presence';

describe('RoomPresence', () => {
  it('tracks selected characters as room occupants without leaking socket data', () => {
    const presence = new RoomPresence();

    presence.selectCharacter({
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
    presence.selectCharacter({
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
    presence.selectCharacter({
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
    presence.selectCharacter({
      socketId: 'socket-1',
      accountId: 'account-1',
      username: 'runner',
      characterId: 'char-1',
      characterName: 'Chrome Fox',
      roomId: 'room-a',
    });

    const replaced = presence.selectCharacter({
      socketId: 'socket-2',
      accountId: 'account-1',
      username: 'runner',
      characterId: 'char-2',
      characterName: 'Neon Wraith',
      roomId: 'room-b',
    });

    expect(replaced).toEqual({
      socketId: 'socket-1',
      characterId: 'char-1',
      characterName: 'Chrome Fox',
      previousRoomId: 'room-a',
    });
    expect(presence.getRoomOccupants('room-a')).toEqual([]);
    expect(presence.getRoomOccupants('room-b')).toEqual([
      { characterId: 'char-2', name: 'Neon Wraith' },
    ]);
  });
});
