export type HotkeyMap = Record<string, string>;

export function resolveHotkey(command: string, hotkeys: HotkeyMap): string {
  const trigger = command.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(hotkeys, trigger)
    ? hotkeys[trigger]
    : command;
}

type PersistHotkeys = (hotkeys: HotkeyMap) => Promise<HotkeyMap>;

export interface HotkeyMutationQueue {
  save(trigger: string, command: string): Promise<HotkeyMap>;
  remove(trigger: string): Promise<HotkeyMap>;
  snapshot(): HotkeyMap;
}

export function createHotkeyMutationQueue(
  initialHotkeys: HotkeyMap,
  persist: PersistHotkeys,
): HotkeyMutationQueue {
  let current = { ...initialHotkeys };
  let tail: Promise<void> = Promise.resolve();

  const enqueue = (mutate: (hotkeys: HotkeyMap) => HotkeyMap): Promise<HotkeyMap> => {
    const operation = tail.then(async () => {
      const saved = await persist(mutate(current));
      current = { ...saved };
      return { ...current };
    });

    tail = operation.then(() => undefined, () => undefined);
    return operation;
  };

  return {
    save(trigger, command) {
      const normalizedTrigger = trigger.trim().toLowerCase();
      return enqueue((hotkeys) => ({
        ...hotkeys,
        [normalizedTrigger]: command,
      }));
    },
    remove(trigger) {
      return enqueue((hotkeys) => {
        const next = { ...hotkeys };
        delete next[trigger];
        return next;
      });
    },
    snapshot() {
      return { ...current };
    },
  };
}
