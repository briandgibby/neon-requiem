import { MissionTemplate, ActiveMission } from '@prisma/client';

export type MissionType = 'RETRIEVAL' | 'EXTRACTION' | 'COURIER' | 'SABOTAGE' | 'MATRIX' | 'ASSASSINATION';
export type MissionStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'SCRUBBED';

export interface MissionTemplateRecord extends MissionTemplate {}
export interface ActiveMissionRecord extends ActiveMission {}

export interface MissionObjective {
  type: string;
  description: string;
  isMandatory: boolean;
  isCompleted: boolean;
  targetId?: string;
  targetRoomSlug?: string;
}

export interface MissionInstanceData {
  layout: string[]; // List of room slugs generated for this instance
  objectives: MissionObjective[];
  spawnData: {
    npcId: string;
    roomSlug: string;
    isTarget: boolean;
  }[];
}

export interface AcceptMissionInput {
  templateSlug: string;
  characterId: string;
  accountId: string;
  partyId?: string;
}

export interface MissionExfilResult {
  success: boolean;
  message: string;
  payout: number;
  xpGained: number;
}
