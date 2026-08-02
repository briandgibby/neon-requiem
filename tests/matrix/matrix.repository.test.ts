import { MatrixRepository } from '../../src/domains/matrix/matrix.repository';

const persistedNode = {
  id: 'node-1',
  slug: 'corp-host',
  name: 'Corp Host',
  description: 'A corporate host.',
  securityLevel: 3,
  hostType: 'corporate',
  alertLevel: 'GREEN',
  roomId: 'room-1',
  requiresPhysicalPresence: true,
  activeIC: [{
    id: 'ice-1',
    slug: 'patrol-ice',
    name: 'Patrol ICE',
    type: 'WHITE',
    nodeId: 'node-1',
    hp: 20,
    currentHp: 20,
    attack: 5,
    defense: 2,
    hardening: 0,
  }],
};

describe('MatrixRepository hydration', () => {
  it('returns a checked ICE kind through the node hydration seam', async () => {
    const db = {
      matrixNode: { findUnique: jest.fn().mockResolvedValue(persistedNode) },
    };
    const repository = new MatrixRepository(db as any);

    await expect(repository.findNodeByRoomId('room-1')).resolves.toEqual(persistedNode);
  });

  it('rejects an invalid persisted ICE kind before it reaches ECS state', async () => {
    const db = {
      matrixNode: {
        findUnique: jest.fn().mockResolvedValue({
          ...persistedNode,
          activeIC: [{ ...persistedNode.activeIC[0], type: 'UNKNOWN' }],
        }),
      },
    };
    const repository = new MatrixRepository(db as any);

    await expect(repository.findNodeByRoomId('room-1')).rejects.toThrow();
  });
});
