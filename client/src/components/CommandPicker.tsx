import { useEffect, useMemo, useState } from 'react';

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
  isMatrixMode?: boolean;
  onCommand: (command: string) => void;
}

export function CommandPicker({ commands, isMatrixMode = false, onCommand }: CommandPickerProps) {
  const [selectedAlias, setSelectedAlias] = useState('');
  const [args, setArgs] = useState('');
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

  const runCommand = (command: CommandMetadata, commandArgs = '') => {
    const trimmedArgs = commandArgs.trim();
    const commandText = command.aliases.includes(trimmedArgs)
      ? trimmedArgs
      : [command.aliases[0], trimmedArgs].filter(Boolean).join(' ');
    onCommand(commandText);
  };

  const handleQuickCommand = (command: CommandMetadata) => {
    if (command.usage) {
      setSelectedAlias(command.aliases[0]);
      setArgs('');
      return;
    }

    runCommand(command);
  };

  const handleSubmit = () => {
    if (!selectedCommand) return;
    runCommand(selectedCommand, args);
    setArgs('');
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
      </div>
    </div>
  );
}
