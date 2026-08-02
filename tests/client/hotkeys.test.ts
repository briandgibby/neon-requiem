import { createHotkeyMutationQueue, resolveHotkey } from '../../client/src/lib/hotkeys';

describe('resolveHotkey', () => {
  it('expands an exact trigger before command dispatch', () => {
    expect(resolveHotkey('  Q  ', { q: 'north' })).toBe('north');
  });

  it('preserves commands that are not mapped', () => {
    expect(resolveHotkey('look', { q: 'north' })).toBe('look');
  });

  it('does not resolve inherited object properties as hotkeys', () => {
    expect(resolveHotkey('constructor', {})).toBe('constructor');
    expect(resolveHotkey('__proto__', {})).toBe('__proto__');
  });
});

describe('createHotkeyMutationQueue', () => {
  it('serializes concurrent mutations against the latest saved map', async () => {
    const persisted: Array<Record<string, string>> = [];
    const queue = createHotkeyMutationQueue({}, async (hotkeys) => {
      await Promise.resolve();
      persisted.push(hotkeys);
      return hotkeys;
    });

    await Promise.all([
      queue.save('q', 'east'),
      queue.save('x', 'look'),
    ]);

    expect(persisted).toEqual([
      { q: 'east' },
      { q: 'east', x: 'look' },
    ]);
    expect(queue.snapshot()).toEqual({ q: 'east', x: 'look' });
  });
});
