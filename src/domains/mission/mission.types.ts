import { MissionTemplate, ActiveMission } from '@prisma/client';

export type MissionType = 'RETRIEVAL' | 'EXTRACTION' | 'COURIER' | 'SABOTAGE' | 'MATRIX' | 'ASSASSINATION';
export type MissionStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'SCRUBBED';
export type InstanceAlertLevel = 'GREEN' | 'YELLOW' | 'RED';
export type ActiveInstanceAlertLevel = Exclude<InstanceAlertLevel, 'GREEN'>;

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
    templateSlug: string;
    roomSlug: string;
    roomId?: string;       // resolved DB room ID (set for instance rooms)
    isTarget: boolean;
    objectiveIndex?: number;
  }[];
  nodeTargetData: {
    roomSlug: string;
    roomId?: string;
    objectiveIndex: number;
    hackThreshold: number;
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

export type InstanceAlertUpdateResult =
  | 'escalated'
  | 'source-updated'
  | 'unchanged'
  | 'not-in-instance'
  | 'inactive-instance';
