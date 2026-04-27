import { Direction, SecurityRating } from '../../shared/types';

export interface RoomRecord {
  id: string;
  slug: string;
  zoneId: string;
  name: string;
  description: string;
  securityRating: SecurityRating | null;
  isMatrixNode: boolean;
  exits: Record<Direction, string> | null;
  npcSpawnTable: string | null;
  factionOwner: string | null;
  isClean: boolean;
  lastCombatAt: Date | null;
  isPOI: boolean;
  poiCategory: string | null;
  gridX: number | null;
  gridY: number | null;
}

export interface ZoneRecord {
  id: string;
  slug: string;
  name: string;
  securityRating: SecurityRating;
}

export interface MovementResult {
  success: boolean;
  error?: string;
  room?: RoomRecord;
}
