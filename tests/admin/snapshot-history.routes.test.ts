import Fastify from 'fastify';
import { registerSnapshotHistoryRoutes } from '../../src/domains/admin/snapshot-history.routes';
import { SnapshotHistoryService } from '../../src/domains/admin/snapshot-history.service';

function createApp() {
  const app = Fastify();
  const repository = {
    isAccountAdmin: jest.fn().mockResolvedValue(true),
    findSnapshots: jest.fn().mockResolvedValue([]),
  };
  const service = new SnapshotHistoryService(repository);
  const authService = {
    verifyToken: jest.fn().mockReturnValue({ accountId: 'admin-1', username: 'operator' }),
  };
  registerSnapshotHistoryRoutes(app, service as any, authService as any);
  return { app, repository };
}

describe('snapshot history routes', () => {
  it('passes authenticated, validated filters to the service', async () => {
    const { app, repository } = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/admin/snapshots?characterId=character-1&limit=25',
      headers: { Authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.findSnapshots).toHaveBeenCalledWith({
      characterId: 'character-1',
      limit: 25,
    });
  });

  it('rejects out-of-range limits', async () => {
    const { app, repository } = createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/admin/snapshots?limit=101',
      headers: { Authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(422);
    expect(repository.isAccountAdmin).toHaveBeenCalledWith('admin-1');
    expect(repository.findSnapshots).not.toHaveBeenCalled();
  });

  it('checks current admin state before validating query parameters', async () => {
    const { app, repository } = createApp();
    repository.isAccountAdmin.mockResolvedValue(false);

    const response = await app.inject({
      method: 'GET',
      url: '/admin/snapshots?limit=101',
      headers: { Authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'Forbidden' });
    expect(repository.findSnapshots).not.toHaveBeenCalled();
  });
});
