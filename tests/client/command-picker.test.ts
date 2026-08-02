import { composePickerCommand } from '../../client/src/lib/command-picker';

describe('composePickerCommand', () => {
  it('preserves a selected movement alias as the whole command', () => {
    expect(composePickerCommand(
      { aliases: ['n', 's', 'e', 'w'], argumentSource: 'direction' },
      '',
      'e',
    )).toBe('e');
  });

  it('uses the opaque ICE id selected for a data spike', () => {
    expect(composePickerCommand(
      { aliases: ['spike'], argumentSource: 'ice' },
      '',
      'ice-db-1',
    )).toBe('spike ice-db-1');
  });

  it('preserves a stable suggested character selector in free text', () => {
    expect(composePickerCommand(
      { aliases: ['tell'] },
      '@neon-requiem-character-selector:char-2 meet me at the clinic',
    )).toBe('tell @neon-requiem-character-selector:char-2 meet me at the clinic');
  });
});
