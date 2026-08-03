import { useEffect, useMemo, useState } from 'react';
import type { HotkeyMap } from '../lib/hotkeys';
import { composePickerCommand } from '../lib/command-picker';
import type { CommandArgumentSource, CommandArgumentSuggestionSource } from '../lib/command-picker';

export type CommandMode = 'physical' | 'matrix' | 'wireless' | 'any';

export interface CommandMetadata {
  aliases: string[];
  mode: CommandMode;
  label: string;
  description: string;
  usage?: string;
  argumentSource?: CommandArgumentSource;
  argumentSuggestionSource?: CommandArgumentSuggestionSource;
}

export interface CommandArgumentOption {
  value: string;
  label: string;
}

interface CommandPickerProps {
  commands: CommandMetadata[];
  hotkeys: HotkeyMap;
  argumentOptions?: Partial<Record<CommandArgumentSource, CommandArgumentOption[]>>;
  argumentSuggestions?: Partial<Record<CommandArgumentSuggestionSource, CommandArgumentOption[]>>;
  isMatrixMode?: boolean;
  onCommand: (command: string) => void;
  onArgumentSourceSelected?: (source: CommandArgumentSource) => void;
  onSaveHotkey: (trigger: string, command: string) => Promise<boolean>;
  onRemoveHotkey: (trigger: string) => Promise<boolean>;
  isSavingHotkey?: boolean;
}

export function CommandPicker({
  commands,
  hotkeys,
  argumentOptions = {},
  argumentSuggestions = {},
  isMatrixMode = false,
  onCommand,
  onArgumentSourceSelected,
  onSaveHotkey,
  onRemoveHotkey,
  isSavingHotkey = false,
}: CommandPickerProps) {
  const [draft, setDraft] = useState({ alias: '', args: '', selectedArgument: '' });
  const [hotkeyTrigger, setHotkeyTrigger] = useState('');
  const activeMode: CommandMode = isMatrixMode ? 'matrix' : 'physical';

  const visibleCommands = useMemo(() => {
    return commands.filter((command) => (
      command.mode === 'any'
      || command.mode === activeMode
      || (activeMode === 'physical' && command.mode === 'wireless')
    ));
  }, [activeMode, commands]);

  const selectedAlias = visibleCommands.some((command) => command.aliases[0] === draft.alias)
    ? draft.alias
    : visibleCommands[0]?.aliases[0] ?? '';
  const selectedCommand = visibleCommands.find((command) => command.aliases[0] === selectedAlias);
  const args = draft.alias === selectedAlias ? draft.args : '';
  const selectedArgument = draft.alias === selectedAlias ? draft.selectedArgument : '';

  const availableArguments = selectedCommand?.argumentSource
    ? argumentOptions[selectedCommand.argumentSource] ?? []
    : [];
  const selectedArgumentValue = availableArguments.some((option) => option.value === selectedArgument)
    ? selectedArgument
    : availableArguments[0]?.value ?? '';
  const availableSuggestions = selectedCommand?.argumentSuggestionSource
    ? argumentSuggestions[selectedCommand.argumentSuggestionSource] ?? []
    : [];

  useEffect(() => {
    if (selectedCommand?.argumentSource) {
      onArgumentSourceSelected?.(selectedCommand.argumentSource);
    }
  }, [onArgumentSourceSelected, selectedCommand?.argumentSource]);

  const composeCommand = (command: CommandMetadata, commandArgs = '') => {
    return composePickerCommand(command, commandArgs, selectedArgumentValue);
  };

  const runCommand = (command: CommandMetadata, commandArgs = '') => {
    onCommand(composeCommand(command, commandArgs));
  };

  const handleQuickCommand = (command: CommandMetadata) => {
    setDraft({ alias: command.aliases[0], args: '', selectedArgument: '' });

    if (command.usage) {
      return;
    }

    runCommand(command);
  };

  const handleSubmit = () => {
    if (!selectedCommand) return;
    runCommand(selectedCommand, args);
    setDraft((current) => ({ ...current, alias: selectedAlias, args: '' }));
  };

  const handleSaveHotkey = async () => {
    if (!selectedCommand || !hotkeyTrigger.trim() || !isCommandReady) return;
    const saved = await onSaveHotkey(hotkeyTrigger, composeCommand(selectedCommand, args));
    if (saved) setHotkeyTrigger('');
  };

  const isCommandReady = Boolean(
    selectedCommand
    && (!selectedCommand.argumentSource || selectedArgumentValue),
  );

  return (
    <div className="h-full flex flex-col gap-3">
      <div className={`text-[10px] ${isMatrixMode ? 'text-cyan-400/50' : 'text-[#00ff41]/50'} uppercase tracking-widest`}>
        Command Picker
      </div>

      <div className="grid grid-cols-2 gap-2 overflow-y-auto custom-scrollbar pr-1">
        {visibleCommands.length > 0 ? (
          visibleCommands.map((command) => (
            <button
              key={command.aliases[0]}
              onClick={() => handleQuickCommand(command)}
              title={command.description}
              className={`min-h-10 border px-2 py-1 text-left text-[9px] uppercase tracking-wider transition-colors ${
                selectedCommand?.aliases[0] === command.aliases[0]
                  ? (isMatrixMode ? 'border-cyan-400/70 bg-cyan-400/20 text-cyan-200' : 'border-[#00ff41]/70 bg-[#00ff41]/20 text-[#00ff41]')
                  : (isMatrixMode ? 'border-cyan-500/20 hover:border-cyan-400/50 hover:bg-cyan-500/10' : 'border-[#00ff41]/20 hover:border-[#00ff41]/50 hover:bg-[#00ff41]/10')
              }`}
            >
              <div className="font-bold">{command.label}</div>
              <div className="opacity-40 normal-case truncate">{command.aliases[0]}</div>
            </button>
          ))
        ) : (
          <div className="col-span-2 text-[10px] italic opacity-30 p-2 text-center">
            Loading command catalog...
          </div>
        )}
      </div>

      <div className={`mt-auto border-t pt-3 ${isMatrixMode ? 'border-cyan-500/20' : 'border-[#00ff41]/20'}`}>
        <div className="text-[9px] opacity-60 min-h-8">
          {selectedCommand ? selectedCommand.description : 'Select a command.'}
        </div>

        {selectedCommand?.argumentSource && (
          <select
            aria-label={`${selectedCommand.label} target`}
            value={selectedArgumentValue}
            onChange={(event) => setDraft((current) => ({
              ...current,
              alias: selectedAlias,
              selectedArgument: event.target.value,
            }))}
            disabled={availableArguments.length === 0}
            className={`mt-2 w-full bg-black/80 border px-2 py-1 text-[10px] outline-none disabled:opacity-40 ${
              isMatrixMode ? 'border-cyan-500/30 focus:border-cyan-400 text-cyan-100' : 'border-[#00ff41]/30 focus:border-[#00ff41] text-[#00ff41]'
            }`}
          >
            {availableArguments.length === 0 && <option value="">No targets available</option>}
            {availableArguments.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        )}

        {selectedCommand?.usage && !selectedCommand.argumentSource && (
          <input
            aria-label={`${selectedCommand.label} arguments`}
            list={availableSuggestions.length > 0 ? 'command-argument-suggestions' : undefined}
            value={args}
            onChange={(event) => setDraft((current) => ({
              ...current,
              alias: selectedAlias,
              args: event.target.value,
            }))}
            placeholder={selectedCommand.usage}
            className={`mt-2 w-full bg-black/40 border px-2 py-1 text-[10px] outline-none ${
              isMatrixMode ? 'border-cyan-500/30 focus:border-cyan-400 text-cyan-100' : 'border-[#00ff41]/30 focus:border-[#00ff41] text-[#00ff41]'
            }`}
          />
        )}

        {availableSuggestions.length > 0 && (
          <datalist id="command-argument-suggestions">
            {availableSuggestions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </datalist>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isCommandReady}
          className={`mt-2 w-full border py-1 text-[9px] font-bold uppercase tracking-[0.25em] transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            isMatrixMode ? 'border-cyan-400/50 hover:bg-cyan-400/20' : 'border-[#00ff41]/50 hover:bg-[#00ff41]/20'
          }`}
        >
          Run {selectedCommand?.aliases[0] ?? 'Command'}
        </button>

        <div className={`mt-3 border-t pt-3 ${isMatrixMode ? 'border-cyan-500/20' : 'border-[#00ff41]/20'}`}>
          <div className="text-[9px] opacity-60 uppercase tracking-widest">Saved Hotkeys</div>
          <select
            aria-label="Hotkey command"
            value={selectedCommand?.aliases[0] ?? ''}
            onChange={(event) => {
              setDraft({ alias: event.target.value, args: '', selectedArgument: '' });
            }}
            className={`mt-2 w-full bg-black/80 border px-2 py-1 text-[10px] outline-none ${
              isMatrixMode ? 'border-cyan-500/30 focus:border-cyan-400 text-cyan-100' : 'border-[#00ff41]/30 focus:border-[#00ff41] text-[#00ff41]'
            }`}
          >
            {visibleCommands.map((command) => (
              <option key={command.aliases[0]} value={command.aliases[0]}>
                {command.label}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <input
              value={hotkeyTrigger}
              onChange={(event) => setHotkeyTrigger(event.target.value)}
              placeholder="Trigger"
              maxLength={24}
              className={`min-w-0 flex-1 bg-black/40 border px-2 py-1 text-[10px] outline-none ${
                isMatrixMode ? 'border-cyan-500/30 focus:border-cyan-400 text-cyan-100' : 'border-[#00ff41]/30 focus:border-[#00ff41] text-[#00ff41]'
              }`}
            />
            <button
              onClick={() => void handleSaveHotkey()}
              disabled={!isCommandReady || !hotkeyTrigger.trim() || isSavingHotkey}
              className={`border px-2 text-[9px] uppercase disabled:opacity-30 ${
                isMatrixMode ? 'border-cyan-400/50 hover:bg-cyan-400/20' : 'border-[#00ff41]/50 hover:bg-[#00ff41]/20'
              }`}
            >
              Save
            </button>
          </div>

          <div className="mt-2 max-h-16 space-y-1 overflow-y-auto custom-scrollbar">
            {Object.entries(hotkeys).map(([trigger, command]) => (
              <div key={trigger} className="flex gap-1 text-[9px]">
                <button
                  onClick={() => onCommand(command)}
                  title={command}
                  className="min-w-0 flex-1 truncate border border-current/20 px-2 py-1 text-left hover:bg-white/10"
                >
                  {trigger} → {command}
                </button>
                <button
                  onClick={() => void onRemoveHotkey(trigger)}
                  disabled={isSavingHotkey}
                  aria-label={`Remove hotkey ${trigger}`}
                  className="border border-current/20 px-2 hover:bg-red-500/20 hover:text-red-300 disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
