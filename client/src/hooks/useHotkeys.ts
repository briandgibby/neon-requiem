import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';
import { createHotkeyMutationQueue } from '../lib/hotkeys';
import type { HotkeyMap, HotkeyMutationQueue } from '../lib/hotkeys';

interface UseHotkeysOptions {
  token: string;
  characterId: string;
  initialHotkeys: HotkeyMap;
  onError: (message: string) => void;
}

interface QueueRef {
  key: string;
  queue: HotkeyMutationQueue;
}

export function useHotkeys({
  token,
  characterId,
  initialHotkeys,
  onError,
}: UseHotkeysOptions) {
  const [hotkeys, setHotkeys] = useState<HotkeyMap>(initialHotkeys);
  const [pendingWrites, setPendingWrites] = useState(0);
  const queueRef = useRef<QueueRef | undefined>(undefined);
  const queueKey = `${token}:${characterId}`;

  if (!queueRef.current || queueRef.current.key !== queueKey) {
    const persist = async (nextHotkeys: HotkeyMap): Promise<HotkeyMap> => {
      const response = await fetch(apiUrl(`/characters/${characterId}/hotkeys`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hotkeys: nextHotkeys }),
      });
      const data = await response.json() as { hotkeys?: HotkeyMap; error?: string };
      if (!response.ok || !data.hotkeys) {
        throw new Error(data.error ?? 'Failed to save hotkeys');
      }
      return data.hotkeys;
    };

    queueRef.current = {
      key: queueKey,
      queue: createHotkeyMutationQueue(initialHotkeys, persist),
    };
  }

  const queue = queueRef.current.queue;

  useEffect(() => {
    setHotkeys(queue.snapshot());
  }, [queue]);

  const runMutation = async (operation: Promise<HotkeyMap>): Promise<boolean> => {
    setPendingWrites((count) => count + 1);
    try {
      setHotkeys(await operation);
      return true;
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to save hotkeys');
      return false;
    } finally {
      setPendingWrites((count) => count - 1);
    }
  };

  return {
    hotkeys,
    isSavingHotkey: pendingWrites > 0,
    saveHotkey: (trigger: string, command: string) => runMutation(queue.save(trigger, command)),
    removeHotkey: (trigger: string) => runMutation(queue.remove(trigger)),
  };
}
