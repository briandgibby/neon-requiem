export type Disposition = 'HOSTILE' | 'SUSPICIOUS' | 'NEUTRAL' | 'FRIENDLY';

export interface TalkResult {
  success: boolean;
  message: string;
  newDisposition: Disposition;
}

export interface BribeResult {
  success: boolean;
  message: string;
  cost: number;
}

export interface DisguiseResult {
  success: boolean;
  message: string;
  identity: string | null;
}

export interface SINResult {
  success: boolean;
  message: string;
  hasValidSIN: boolean;
}
