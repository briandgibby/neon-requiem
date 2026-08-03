import { useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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

function getPrompt(isMatrixMode?: boolean) {
  return isMatrixMode ? '\x1b[1;36m[LINK] > \x1b[0m' : '\x1b[1;32m> \x1b[0m';
}

export const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ onInput, isMatrixMode }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const commandBuffer = useRef<string>('');
  const onInputRef = useRef(onInput);
  const isMatrixModeRef = useRef(isMatrixMode);
  const isReadyRef = useRef(false);
  const pendingWritesRef = useRef<Array<{ method: 'write' | 'writeln'; text: string }>>([]);

  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

  const writeToTerminal = useCallback((method: 'write' | 'writeln', text: string) => {
    const term = xtermRef.current;
    if (!term || !isReadyRef.current) {
      pendingWritesRef.current.push({ method, text });
      return;
    }

    try {
      term[method](text);
    } catch (err) {
      console.error('[Terminal] xterm write failed:', err);
    }
  }, []);

  const flushPendingWrites = useCallback(() => {
    const pending = pendingWritesRef.current;
    pendingWritesRef.current = [];
    pending.forEach(({ method, text }) => writeToTerminal(method, text));
  }, [writeToTerminal]);

  useImperativeHandle(ref, () => ({
    write: (text: string) => writeToTerminal('write', text),
    writeln: (text: string) => writeToTerminal('writeln', text),
    clear: () => xtermRef.current?.clear(),
  }), [writeToTerminal]);

  // Update theme when Matrix mode changes
  useEffect(() => {
    isMatrixModeRef.current = isMatrixMode;
    if (xtermRef.current) {
      xtermRef.current.options.theme = {
        background: '#050505',
        foreground: isMatrixMode ? '#22d3ee' : '#00ff41',
        cursor: isMatrixMode ? '#22d3ee' : '#00ff41',
        selectionBackground: isMatrixMode ? 'rgba(34, 211, 238, 0.3)' : 'rgba(0, 255, 65, 0.3)',
      };
      
      // Re-write the prompt if it was just changed
      writeToTerminal('write', '\r\n' + getPrompt(isMatrixMode));
    }
  }, [isMatrixMode, writeToTerminal]);

  useEffect(() => {
    if (!terminalRef.current) return;
    const terminalElement = terminalRef.current;

    const term = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#050505',
        foreground: isMatrixModeRef.current ? '#22d3ee' : '#00ff41',
        cursor: isMatrixModeRef.current ? '#22d3ee' : '#00ff41',
        selectionBackground: isMatrixModeRef.current ? 'rgba(34, 211, 238, 0.3)' : 'rgba(0, 255, 65, 0.3)',
      },
      fontFamily: 'Courier New, Courier, monospace',
      fontSize: 14,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Defer fit and initial writes until after first paint so the flex container
    // has real pixel dimensions — calling fit() with a 0-height element corrupts
    // the renderer's cell metrics and crashes subsequent writes.
    let rafId = 0;
    const initializeTerminal = () => {
      const bounds = terminalElement.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) {
        rafId = requestAnimationFrame(initializeTerminal);
        return;
      }

      try {
        term.open(terminalElement);
        xtermRef.current = term;
        fitAddon.fit();
        isReadyRef.current = true;
        writeToTerminal('writeln', '\x1b[1;32mNEON REQUIEM [Version 1.0.0]\x1b[0m');
        writeToTerminal('writeln', 'Connecting to neural link...\x1b[5m_\x1b[0m');
        writeToTerminal('write', '\r\n' + getPrompt(isMatrixModeRef.current));
        flushPendingWrites();
      } catch (err) {
        console.error('[Terminal] xterm initialization failed:', err);
      }
    };
    rafId = requestAnimationFrame(initializeTerminal);

    term.onData((data) => {
      if (data === '\r') { // Enter
        const command = commandBuffer.current.trim();
        writeToTerminal('write', '\r\n');
        onInputRef.current?.(command);
        commandBuffer.current = '';
        writeToTerminal('write', getPrompt(isMatrixModeRef.current));
      } else if (data === '\u007f') { // Backspace
        if (commandBuffer.current.length > 0) {
          commandBuffer.current = commandBuffer.current.slice(0, -1);
          writeToTerminal('write', '\b \b');
        }
      } else {
        commandBuffer.current += data;
        writeToTerminal('write', data);
      }
    });

    const handleResize = () => {
      try { fitAddon.fit(); } catch { /* ignore */ }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      isReadyRef.current = false;
      pendingWritesRef.current = [];
      term.dispose();
      if (xtermRef.current === term) xtermRef.current = null;
      window.removeEventListener('resize', handleResize);
    };
  }, [flushPendingWrites, writeToTerminal]);

  return (
    <div className="w-full h-full p-4 relative overflow-hidden bg-[#050505]">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
});
