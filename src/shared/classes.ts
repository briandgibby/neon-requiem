import { ClassName, ClassLine } from './types';

export interface ClassTitles {
  tier1: string;
  tier2: string;
  tier3: string;
}

export interface ClassData {
  slug: ClassName;
  line: ClassLine;
  isAwakened: boolean;
  isMatrix: boolean;
  requiresStreetDocPath: boolean;
  titles: ClassTitles;
}

export const CLASS_DATA: Record<ClassName, ClassData> = {
  'street-samurai': { slug: 'street-samurai', line: 'combat',   isAwakened: false, isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Street Samurai',   tier2: 'Chrome Samurai',     tier3: 'Ronin'               } },
  razorboy:         { slug: 'razorboy',        line: 'combat',   isAwakened: false, isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Razorboy',          tier2: 'Blademaster',        tier3: 'Edge Phantom'        } },
  'bounty-hunter':  { slug: 'bounty-hunter',   line: 'combat',   isAwakened: false, isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Bounty Hunter',     tier2: 'Hunter Prime',       tier3: 'Reaper'              } },
  mercenary:        { slug: 'mercenary',        line: 'combat',   isAwakened: false, isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Mercenary',         tier2: 'Iron Soldier',       tier3: 'Black Op'            } },
  face:             { slug: 'face',             line: 'shadow',   isAwakened: false, isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Face',              tier2: 'Fixer',              tier3: 'Shadow Broker'       } },
  infiltrator:      { slug: 'infiltrator',      line: 'shadow',   isAwakened: false, isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Infiltrator',       tier2: 'Ghost',              tier3: 'Wraith'              } },
  rigger:           { slug: 'rigger',           line: 'shadow',   isAwakened: false, isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Rigger',            tier2: 'Drone Lord',         tier3: 'Machine Sovereign'   } },
  smuggler:         { slug: 'smuggler',         line: 'shadow',   isAwakened: false, isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Smuggler',          tier2: 'Syndicate Runner',   tier3: 'Crime Lord'          } },
  decker:           { slug: 'decker',           line: 'matrix',   isAwakened: false, isMatrix: true,  requiresStreetDocPath: false, titles: { tier1: 'Decker',            tier2: 'Sys-Op',             tier3: 'Net Phantom'         } },
  technomancer:     { slug: 'technomancer',     line: 'matrix',   isAwakened: false, isMatrix: true,  requiresStreetDocPath: false, titles: { tier1: 'Technomancer',      tier2: 'Resonance Adept',    tier3: 'Prime Technomancer'  } },
  'mage-hermetic':  { slug: 'mage-hermetic',    line: 'awakened', isAwakened: true,  isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Mage (Hermetic)',   tier2: 'Conjurer',           tier3: 'Archmage'            } },
  shaman:           { slug: 'shaman',           line: 'awakened', isAwakened: true,  isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Shaman',            tier2: 'Elder Shaman',       tier3: 'Spirit Walker'       } },
  'street-doc':     { slug: 'street-doc',       line: 'awakened', isAwakened: true,  isMatrix: false, requiresStreetDocPath: true,  titles: { tier1: 'Street Doc',        tier2: 'Trauma Surgeon',     tier3: 'Ripperdoc Prime'     } },
  'weapons-adept':  { slug: 'weapons-adept',    line: 'awakened', isAwakened: true,  isMatrix: false, requiresStreetDocPath: false, titles: { tier1: 'Weapons Adept',     tier2: 'Iron Monk',          tier3: 'Weapon Saint'        } },
};
