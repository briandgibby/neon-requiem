import type { HotkeyMap } from './lib/hotkeys';

export interface Character {
  id: string;
  name: string;
  level: number;
  faction: string;
  className: string;
  currentHp: number;
  maxHp: number;
  currentStun?: number;
  maxStun?: number;
  currentAp?: number;
  maxAp?: number;
  armorValue: number;
  isJackedIn?: boolean;
  areaKnowledge?: string[];
  hotkeys?: HotkeyMap;
}
