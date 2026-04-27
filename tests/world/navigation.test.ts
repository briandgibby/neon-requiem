import { NavigationUtils } from '../../src/domains/world/navigation';
import { RoomRecord } from '../../src/domains/world/world.types';

describe('NavigationUtils', () => {
  const mockRooms: RoomRecord[] = [
    { id: '1', slug: 'room-1', exits: { north: 'room-2' } } as any,
    { id: '2', slug: 'room-2', exits: { south: 'room-1', east: 'room-3' } } as any,
    { id: '3', slug: 'room-3', exits: { west: 'room-2' } } as any,
  ];

  it('finds a direct path', () => {
    const path = NavigationUtils.findPath('1', '2', mockRooms);
    expect(path).toHaveLength(1);
    expect(path![0]).toEqual({ roomId: '2', direction: 'north' });
  });

  it('finds a multi-step path', () => {
    const path = NavigationUtils.findPath('1', '3', mockRooms);
    expect(path).toHaveLength(2);
    expect(path![0]).toEqual({ roomId: '2', direction: 'north' });
    expect(path![1]).toEqual({ roomId: '3', direction: 'east' });
  });

  it('returns empty array for same room', () => {
    const path = NavigationUtils.findPath('1', '1', mockRooms);
    expect(path).toEqual([]);
  });

  it('returns null if no path exists', () => {
    const isolatedRoom = { id: '4', slug: 'room-4', exits: {} } as any;
    const path = NavigationUtils.findPath('1', '4', [...mockRooms, isolatedRoom]);
    expect(path).toBeNull();
  });
});
