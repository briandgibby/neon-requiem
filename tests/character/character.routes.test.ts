import Fastify from 'fastify';
import { registerCharacterRoutes } from '../../src/domains/character/character.routes';
import { CharacterService } from '../../src/domains/character/character.service';

function createApp() {
  const app = Fastify();
  const characterRepo = {
    findByIdAndAccount: jest.fn().mockResolvedValue({ id: 'char_1', accountId: 'acc_1' }),
    updateCharacter: jest.fn().mockImplementation((id, data) => Promise.resolve({ id, ...data })),
  };
  const service = new CharacterService(characterRepo as any, {} as any);

  registerCharacterRoutes(app, service, {
    verifyToken: jest.fn(() => ({ accountId: 'acc_1', username: 'runner' })),
  } as any);

  return { app, characterRepo };
}

describe('character hotkey routes', () => {
  it('updates hotkeys for the authenticated character owner', async () => {
    const { app, characterRepo } = createApp();

    const response = await app.inject({
      method: 'PATCH',
      url: '/characters/char_1/hotkeys',
      headers: { Authorization: 'Bearer valid-token' },
      payload: { hotkeys: { q: 'north' } },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ hotkeys: { q: 'north' } });
    expect(characterRepo.updateCharacter).toHaveBeenCalledWith('char_1', {
      hotkeys: { q: 'north' },
    });
  });

  it('returns not found instead of updating another account\'s character', async () => {
    const { app, characterRepo } = createApp();
    characterRepo.findByIdAndAccount.mockResolvedValue(null);

    const response = await app.inject({
      method: 'PATCH',
      url: '/characters/char_1/hotkeys',
      headers: { Authorization: 'Bearer valid-token' },
      payload: { hotkeys: { q: 'north' } },
    });

    expect(response.statusCode).toBe(404);
    expect(characterRepo.updateCharacter).not.toHaveBeenCalled();
  });

  it('rejects malformed hotkey maps', async () => {
    const { app } = createApp();

    const response = await app.inject({
      method: 'PATCH',
      url: '/characters/char_1/hotkeys',
      headers: { Authorization: 'Bearer valid-token' },
      payload: { hotkeys: ['north'] },
    });

    expect(response.statusCode).toBe(422);
  });

  it('rejects reserved trigger names without silently dropping them', async () => {
    const { app, characterRepo } = createApp();

    const response = await app.inject({
      method: 'PATCH',
      url: '/characters/char_1/hotkeys',
      headers: { Authorization: 'Bearer valid-token' },
      payload: { hotkeys: { constructor: 'look' } },
    });

    expect(response.statusCode).toBe(422);
    expect(characterRepo.updateCharacter).not.toHaveBeenCalled();
  });
});
