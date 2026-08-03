export type CommandArgumentSource = 'direction' | 'poi' | 'ice' | 'hostile' | 'ally' | 'injured-ally' | 'mission' | 'shop-item';
export type CommandArgumentSuggestionSource = 'occupant';

interface PickerCommand {
  aliases: string[];
  argumentSource?: CommandArgumentSource;
}

export function composePickerCommand(
  command: PickerCommand,
  freeText: string,
  selectedArgument = '',
): string {
  const args = command.argumentSource
    ? [selectedArgument, freeText.trim()].filter(Boolean).join(' ')
    : freeText.trim();

  return command.aliases.includes(args)
    ? args
    : [command.aliases[0], args].filter(Boolean).join(' ');
}
