import { MatrixNode, Item, IntCountermeasure } from '@prisma/client';

export type AlertLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface MatrixHackingResult {
  success: boolean;
  message: string;
  newAlertLevel: AlertLevel;
  damageTaken?: number;
}

export interface DataSpikeResult {
  success: boolean;
  message: string;
  damageDealt: number;
  iceRemainingHp: number;
  nodeAlertLevel: AlertLevel;
}

export interface IceAttackResult {
  iceName: string;
  damage: number;
  message: string;
  resisted: boolean;
}

export interface RepairResult {
  success: boolean;
  message: string;
  remainingCorruption: number;
  inventoryItemId: string;
}

export interface ProgramRecord {
  id: string;
  name: string;
  rating: number;
}
