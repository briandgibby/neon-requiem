import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface TerminalProps {
  onInput?: (command: string) => void;
  isMatrixMode?: boolean;
}

export interface TerminalHandle {
  write: (text: string) => void;
  writeln: (text: string) => void;
  clear: () => void;
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ onInput, isMatrixMode }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const commandBuffer = useRef<string>('');

  const getPrompt = () => isMatrixMode ? '\x1b[1;36m[LINK] > \x1b[0m' : '\x1b[1;32m> \x1b[0m';

  useImperativeHandle(ref, () => ({
    write: (text: string) => xtermRef.current?.write(text),
    writeln: (text: string) => xtermRef.current?.writeln(text),
    clear: () => xtermRef.current?.clear(),
  }));

  // Update theme when Matrix mode changes
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = {
        background: '#050505',
        foreground: isMatrixMode ? '#22d3ee' : '#00ff41',
        cursor: isMatrixMode ? '#22d3ee' : '#00ff41',
        selectionBackground: isMatrixMode ? 'rgba(34, 211, 238, 0.3)' : 'rgba(0, 255, 65, 0.3)',
      };
      
      // Re-write the prompt if it was just changed
      xtermRef.current.write('\r\n' + getPrompt());
    }
  }, [isMatrixMode]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#050505',
        foreground: isMatrixMode ? '#22d3ee' : '#00ff41',
        cursor: isMatrixMode ? '#22d3ee' : '#00ff41',
        selectionBackground: isMatrixMode ? 'rgba(34, 211, 238, 0.3)' : 'rgba(0, 255, 65, 0.3)',
      },
      fontFamily: 'Courier New, Courier, monospace',
      fontSize: 14,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;32mNEON REQUIEM [Version 1.0.0]\x1b[0m');
    term.writeln('Connecting to neural link...\x1b[5m_\x1b[0m');
    term.write('\r\n' + getPrompt());

    term.onData((data) => {
      if (data === '\r') { // Enter
        const command = commandBuffer.current.trim();
        term.write('\r\n');
        if (onInput) {
          onInput(command);
        }
        commandBuffer.current = '';
        term.write(getPrompt());
      } else if (data === '\u007f') { // Backspace
        if (commandBuffer.current.length > 0) {
          commandBuffer.current = commandBuffer.current.slice(0, -1);
          term.write('\b \b');
        }
      } else {
        commandBuffer.current += data;
        term.write(data);
      }
    });

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="w-full h-full p-4 relative overflow-hidden bg-[#050505]">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
});
