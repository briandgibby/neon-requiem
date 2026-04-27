export type Faction = 'shadow' | 'corp';

export type Race =
  | 'human' | 'surge' | 'elf' | 'dark-elf' | 'dwarf' | 'gnome'
  | 'halfling' | 'goblin' | 'ork' | 'oni' | 'troll' | 'minotaur';

export type ClassLine = 'combat' | 'shadow' | 'matrix' | 'awakened';

export type ClassName =
  | 'street-samurai' | 'razorboy' | 'bounty-hunter' | 'mercenary'
  | 'face' | 'infiltrator' | 'rigger' | 'smuggler'
  | 'decker' | 'technomancer'
  | 'mage-hermetic' | 'shaman' | 'street-doc' | 'weapons-adept';

export type MentorSpirit = 'bear' | 'gator' | 'cat' | 'eagle' | 'wolf' | 'rat' | 'valkyrie' | 'chaos';

export type StreetDocPath = 'magic' | 'tech';

export type SecurityRating = 'AAA' | 'AA' | 'A' | 'B' | 'C' | 'D' | 'Z' | 'mission';

export type Direction = 'north' | 'south' | 'east' | 'west' | 'up' | 'down' | 'northeast' | 'northwest' | 'southeast' | 'southwest';

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'legendary' | 'unique';

export type CombatStatus = 'idle' | 'engaged' | 'recovering' | 'guarding';

export type CombatMove = 
  | 'attack' 
  | 'guard' 
  | 'backstab' 
  | 'scattershot' 
  | 'aimed-shot' 
  | 'trip' 
  | 'flee' 
  | 'consume'
  | 'cast'
  | 'hack'
  | 'call-backup'
  | 'suppress-alarm';
export interface AuthPayload {
  accountId: string;
  username: string;
}

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
