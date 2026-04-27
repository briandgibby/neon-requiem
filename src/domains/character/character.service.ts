import { CharacterRepository } from './character.repository';
import { WorldRepository } from '../world/world.repository';
import { CreateCharacterInput, CharacterRecord } from './character.types';
import { RACE_DATA } from '../../shared/races';
import { CLASS_DATA } from '../../shared/classes';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';
import { Race, ClassName } from '../../shared/types';
import { STARTING_ROOM_SHADOW, STARTING_ROOM_CORP, MAX_STARTING_KARMA } from '../../shared/constants';

const VALID_MENTOR_SPIRITS = new Set(['bear', 'gator', 'cat', 'eagle', 'wolf', 'rat', 'valkyrie', 'chaos']);
const BASE_STAT_KEYS = ['body', 'agility', 'dexterity', 'strength', 'logic', 'intuition', 'willpower', 'charisma'] as const;

function calculateStatKarmaCost(floor: number, target: number): number {
  let cost = 0;
  for (let i = floor + 1; i <= target; i++) {
    if (i <= 5) cost += 1;
    else if (i <= 9) cost += 2;
    else cost += 3;
  }
  return cost;
}

export class CharacterService {
  constructor(
    private readonly repo: CharacterRepository,
    private readonly worldRepo: WorldRepository,
  ) {}

  async createCharacter(input: CreateCharacterInput): Promise<CharacterRecord> {
    const raceData = RACE_DATA[input.race as Race];
    if (!raceData) throw new ValidationError(`Unknown race: ${input.race}`);

    const classData = CLASS_DATA[input.className as ClassName];
    if (!classData) throw new ValidationError(`Unknown class: ${input.className}`);

    const existing = await this.repo.findByAccountAndName(input.accountId, input.name);
    if (existing) throw new ConflictError(`Character name '${input.name}' already exists on this account`);

    // 1. Validate Karma & Stat Caps
    let totalKarmaSpent = 0;
    const statsToValidate = [...BASE_STAT_KEYS, 'luck' as const];

    for (const stat of statsToValidate) {
      const value = input[stat];
      const range = (raceData as any)[stat];
      
      if (value < range.floor || value > range.cap) {
        throw new ValidationError(
          `${stat} must be ${range.floor}–${range.cap} for ${input.race} (got ${value})`
        );
      }
      
      totalKarmaSpent += calculateStatKarmaCost(range.floor, value);
    }

    if (totalKarmaSpent > MAX_STARTING_KARMA) {
      throw new ValidationError(`Total Karma cost (${totalKarmaSpent}) exceeds the starting limit of ${MAX_STARTING_KARMA}`);
    }

    if (classData.isAwakened) {
      if (!input.mentorSpirit) throw new ValidationError(`Awakened class '${input.className}' requires a mentorSpirit`);
      if (!VALID_MENTOR_SPIRITS.has(input.mentorSpirit)) throw new ValidationError(`Unknown mentor spirit: ${input.mentorSpirit}`);
    } else if (input.mentorSpirit) {
      throw new ValidationError(`Non-awakened class '${input.className}' cannot have a mentorSpirit`);
    }

    if (classData.requiresStreetDocPath && !input.streetDocPath) {
      throw new ValidationError(`street-doc requires streetDocPath: 'magic' | 'tech'`);
    }
    if (!classData.requiresStreetDocPath && input.streetDocPath) {
      throw new ValidationError(`Class '${input.className}' does not use streetDocPath`);
    }

    const startingRoomSlug = input.faction === 'shadow' ? STARTING_ROOM_SHADOW : STARTING_ROOM_CORP;
    const startingRoom = await this.worldRepo.findRoomBySlug(startingRoomSlug);
    if (!startingRoom) {
      console.warn(`Starting room '${startingRoomSlug}' not found. Character created without initial location.`);
    }

    return this.repo.create({
      accountId: input.accountId,
      name: input.name,
      faction: input.faction,
      race: input.race,
      className: input.className,
      streetDocPath: input.streetDocPath ?? null,
      level: 1,
      experiencePoints: 0,
      nuyen: input.nuyen ?? 1000,
      body: input.body,
      agility: input.agility,
      dexterity: input.dexterity,
      strength: input.strength,
      logic: input.logic,
      intuition: input.intuition,
      willpower: input.willpower,
      charisma: input.charisma,
      biosync: raceData.biosync,
      luck: input.luck,
      luckPool: input.luck,
      
      magic: classData.isAwakened ? 0 : null,
      resonance: classData.isMatrix ? 0 : null,
      
      resAttack: classData.slug === 'technomancer' ? 1 : null,
      resSleaze: classData.slug === 'technomancer' ? 1 : null,
      resDataProc: classData.slug === 'technomancer' ? 1 : null,
      resFirewall: classData.slug === 'technomancer' ? 1 : null,

      mentorSpirit: input.mentorSpirit ?? null,

      masteryCQC: 0,
      masteryEdge: 0,
      masteryImpact: 0,
      masteryPistol: 0,
      masteryRifle: 0,
      masteryAutomatic: 0,
      masteryRigging: 0,
      masterySummoning: 0,

      currentHp: 50 + (input.body * 10) + (input.strength * 5),
      maxHp: 50 + (input.body * 10) + (input.strength * 5),
      currentStun: 50 + (input.willpower * 10) + (input.logic * 5),
      maxStun: 50 + (input.willpower * 10) + (input.logic * 5),
      currentMana: classData.isAwakened ? 50 + (input.willpower * 10) + (input.charisma * 5) : 0,
      maxMana: classData.isAwakened ? 50 + (input.willpower * 10) + (input.charisma * 5) : 0,
      manaRegenRate: 5,
      manaRegenBuff: 0,
      armorValue: 0,
      biofeedbackBuffer: 0,
      deathSicknessUntil: null,
      maxInventorySlots: 5 + input.strength + Math.floor(input.body / 2),

      hasValidSIN: input.faction === 'corp',
      disguiseIdentity: null,
      reputationCorp: input.faction === 'corp' ? 10 : 0,
      reputationShadow: input.faction === 'shadow' ? 10 : 0,
      areaKnowledge: [],

      isJackedIn: false,
      activeNodeId: null,
      equippedDeckId: null,
      activeAuraId: null,

      currentRoomId: startingRoom?.id ?? null,
      isCreationComplete: true,
    });
  }

  async getCharacter(id: string, accountId: string): Promise<CharacterRecord> {
    const character = await this.repo.findByIdAndAccount(id, accountId);
    if (!character) throw new NotFoundError('Character');
    return character;
  }

  async listCharacters(accountId: string): Promise<CharacterRecord[]> {
    return this.repo.findByAccountId(accountId);
  }
}
