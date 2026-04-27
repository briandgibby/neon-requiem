export const TICK_RATE_MS = Number(process.env.TICK_RATE_MS) || 1000;
export const JWT_EXPIRY = '24h';
export const BCRYPT_ROUNDS = 12;
export const MAX_LEVEL = 50;
export const BASE_CLASS_LEVEL_CAP = 8;
export const TIER_2_LEVEL = 25;
export const TIER_3_LEVEL = 40;
export const PVP_PROTECTION_LEVEL = 8;
export const AWAKENED_CLASSES: readonly string[] = ['mage-hermetic', 'shaman', 'street-doc', 'weapons-adept'];
export const MATRIX_CLASSES: readonly string[] = ['decker', 'technomancer'];

export const STARTING_ROOM_SHADOW = 'shadow-hub-center';
export const STARTING_ROOM_CORP = 'corp-hub-center';

export const MAX_AP = 6;
export const COMMAND_AP_PENALTY = 2;

export const AP_COSTS: Record<string, number> = {
  attack: 1,
  guard: 1,
  backstab: 2,
  scattershot: 2,
  'aimed-shot': 2,
  trip: 2,
  flee: 1,
  consume: 0,
  cast: 2,
  hack: 1,
  'call-backup': 1,
  'suppress-alarm': 1,
};

export const MAX_STARTING_KARMA = 50;
export const BASE_WEAPON_POWER = 20;
export const DEFAULT_MISSION_PAYOUT = 1000;

export const ALARM_SUPPRESSION_DIFFICULTY: Record<string, number> = {
  'AAA': 25,
  'AA': 22,
  'A': 18,
  'B': 15,
  'C': 12,
};

export const SOLID_HIT_MIN_PERCENT = 0.81;
export const SOLID_HIT_MAX_PERCENT = 1.0;
export const GLANCING_HIT_MIN_PERCENT = 0.1;
export const GLANCING_HIT_MAX_PERCENT = 0.2;

export const ABSORB_NONE = 1.0;
export const ABSORB_SOME_MIN = 0.6;
export const ABSORB_SOME_MAX = 0.8;
export const ABSORB_MOST_MIN = 0.3;
export const ABSORB_MOST_MAX = 0.5;

export const SECURITY_RESPONSE_TIMES: Record<string, number> = {
  'AAA': 3,
  'AA': 5,
  'A': 8,
  'B': 12,
  'C': 20,
  'D': 30,
  'Z': 40
};

