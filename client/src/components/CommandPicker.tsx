import { useEffect, useMemo, useState } from 'react';
import type { HotkeyMap } from '../lib/hotkeys';

export type CommandMode = 'physical' | 'matrix' | 'wireless' | 'any';

export interface CommandMetadata {
  aliases: string[];
  mode: CommandMode;
  label: string;
  description: string;
  usage?: string;
}

interface CommandPickerProps {
  commands: CommandMetadata[];
  hotkeys: HotkeyMap;
  isMatrixMode?: boolean;
  onCommand: (command: string) => void;
  onSaveHotkey: (trigger: string, command: string) => Promise<boolean>;
  onRemoveHotkey: (trigger: string) => Promise<boolean>;
  isSavingHotkey?: boolean;
}

export function CommandPicker({
  commands,
  hotkeys,
  isMatrixMode = false,
  onCommand,
  onSaveHotkey,
  onRemoveHotkey,
  isSavingHotkey = false,
}: CommandPickerProps) {
  const [selectedAlias, setSelectedAlias] = useState('');
  const [args, setArgs] = useState('');
  const [hotkeyTrigger, setHotkeyTrigger] = useState('');
  const activeMode: CommandMode = isMatrixMode ? 'matrix' : 'physical';

  const visibleCommands = useMemo(() => {
    return commands.filter((command) => (
      command.mode === 'any'
      || command.mode === activeMode
      || (activeMode === 'physical' && command.mode === 'wireless')
    ));
  }, [activeMode, commands]);

  const selectedCommand = visibleCommands.find((command) => command.aliases[0] === selectedAlias)
    ?? visibleCommands[0];

  useEffect(() => {
    if (!selectedCommand) {
      setSelectedAlias('');
      setArgs('');
      return;
    }

    if (selectedAlias !== selectedCommand.aliases[0]) {
      setSelectedAlias(selectedCommand.aliases[0]);
      setArgs('');
    }
  }, [selectedAlias, selectedCommand]);

  const composeCommand = (command: CommandMetadata, commandArgs = '') => {
    const trimmedArgs = commandArgs.trim();
    return command.aliases.includes(trimmedArgs)
      ? trimmedArgs
      : [command.aliases[0], trimmedArgs].filter(Boolean).join(' ');
  };

  const runCommand = (command: CommandMetadata, commandArgs = '') => {
    onCommand(composeCommand(command, commandArgs));
  };

  const handleQuickCommand = (command: CommandMetadata) => {
    setSelectedAlias(command.aliases[0]);
    setArgs('');

    if (command.usage) {
      return;
    }

    runCommand(command);
  };

  const handleSubmit = () => {
    if (!selectedCommand) return;
    runCommand(selectedCommand, args);
    setArgs('');
  };

  const handleSaveHotkey = async () => {
    if (!selectedCommand || !hotkeyTrigger.trim()) return;
    const saved = await onSaveHotkey(hotkeyTrigger, composeCommand(selectedCommand, args));
    if (saved) setHotkeyTrigger('');
  };

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

        {selectedCommand?.usage && (
          <input
            value={args}
            onChange={(event) => setArgs(event.target.value)}
            placeholder={selectedCommand.usage}
            className={`mt-2 w-full bg-black/40 border px-2 py-1 text-[10px] outline-none ${
              isMatrixMode ? 'border-cyan-500/30 focus:border-cyan-400 text-cyan-100' : 'border-[#00ff41]/30 focus:border-[#00ff41] text-[#00ff41]'
            }`}
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedCommand}
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
              setSelectedAlias(event.target.value);
              setArgs('');
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
              disabled={!selectedCommand || !hotkeyTrigger.trim() || isSavingHotkey}
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
