const CHARACTER_SELECTOR_PREFIX = '@neon-requiem-character-selector:';

export function encodeCharacterSelector(characterId: string): string {
  return `${CHARACTER_SELECTOR_PREFIX}${characterId}`;
}

export function decodeCharacterSelector(selector: string): string | null {
  return selector.startsWith(CHARACTER_SELECTOR_PREFIX)
    ? selector.slice(CHARACTER_SELECTOR_PREFIX.length)
    : null;
}
