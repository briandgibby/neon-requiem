import {
  decodeCharacterSelector,
  encodeCharacterSelector,
} from '../../src/shared/character-selector';

describe('character selector protocol', () => {
  it('round-trips a stable character identity', () => {
    const selector = encodeCharacterSelector('char-2');

    expect(selector).toBe('@neon-requiem-character-selector:char-2');
    expect(decodeCharacterSelector(selector)).toBe('char-2');
  });

  it('leaves ordinary character names on the free-text path', () => {
    expect(decodeCharacterSelector('@neo')).toBeNull();
  });
});
