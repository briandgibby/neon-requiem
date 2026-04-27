import { Race } from './types';

export interface StatRange {
  floor: number;
  cap: number;
}

export interface RaceData {
  slug: Race;
  biosync: number;
  biosyncCyberwarePenalty?: number;
  body: StatRange;
  agility: StatRange;
  dexterity: StatRange;
  strength: StatRange;
  logic: StatRange;
  intuition: StatRange;
  willpower: StatRange;
  charisma: StatRange;
  luck: StatRange;
}

export const RACE_DATA: Record<Race, RaceData> = {
  human: {
    slug: 'human', biosync: 6,
    body:      { floor: 1, cap: 6 }, agility:   { floor: 1, cap: 6 },
    dexterity: { floor: 1, cap: 6 }, strength:  { floor: 1, cap: 6 },
    logic:     { floor: 1, cap: 6 }, intuition: { floor: 1, cap: 6 },
    willpower: { floor: 1, cap: 6 }, charisma:  { floor: 1, cap: 6 },
    luck:      { floor: 1, cap: 7 },
  },
  surge: {
    slug: 'surge', biosync: 6, biosyncCyberwarePenalty: 0.1,
    body:      { floor: 1, cap: 5 }, agility:   { floor: 2, cap: 7 },
    dexterity: { floor: 2, cap: 7 }, strength:  { floor: 1, cap: 5 },
    logic:     { floor: 1, cap: 6 }, intuition: { floor: 2, cap: 7 },
    willpower: { floor: 1, cap: 6 }, charisma:  { floor: 1, cap: 6 },
    luck:      { floor: 1, cap: 7 },
  },
  elf: {
    slug: 'elf', biosync: 7,
    body:      { floor: 2, cap: 5 }, agility:   { floor: 3, cap: 7 },
    dexterity: { floor: 2, cap: 7 }, strength:  { floor: 1, cap: 6 },
    logic:     { floor: 2, cap: 7 }, intuition: { floor: 1, cap: 7 },
    willpower: { floor: 1, cap: 6 }, charisma:  { floor: 4, cap: 8 },
    luck:      { floor: 2, cap: 6 },
  },
  'dark-elf': {
    slug: 'dark-elf', biosync: 7,
    body:      { floor: 2, cap: 6 }, agility:   { floor: 1, cap: 7 },
    dexterity: { floor: 2, cap: 7 }, strength:  { floor: 3, cap: 7 },
    logic:     { floor: 1, cap: 7 }, intuition: { floor: 3, cap: 6 },
    willpower: { floor: 2, cap: 7 }, charisma:  { floor: 1, cap: 5 },
    luck:      { floor: 1, cap: 5 },
  },
  dwarf: {
    slug: 'dwarf', biosync: 5,
    body:      { floor: 3, cap: 8 }, agility:   { floor: 2, cap: 5 },
    dexterity: { floor: 3, cap: 7 }, strength:  { floor: 3, cap: 7 },
    logic:     { floor: 1, cap: 6 }, intuition: { floor: 1, cap: 7 },
    willpower: { floor: 2, cap: 7 }, charisma:  { floor: 1, cap: 5 },
    luck:      { floor: 1, cap: 5 },
  },
  gnome: {
    slug: 'gnome', biosync: 6,
    body:      { floor: 1, cap: 4 }, agility:   { floor: 4, cap: 8 },
    dexterity: { floor: 3, cap: 7 }, strength:  { floor: 1, cap: 4 },
    logic:     { floor: 4, cap: 8 }, intuition: { floor: 3, cap: 8 },
    willpower: { floor: 1, cap: 6 }, charisma:  { floor: 1, cap: 7 },
    luck:      { floor: 1, cap: 6 },
  },
  halfling: {
    slug: 'halfling', biosync: 6,
    body:      { floor: 1, cap: 5 }, agility:   { floor: 2, cap: 7 },
    dexterity: { floor: 3, cap: 7 }, strength:  { floor: 1, cap: 4 },
    logic:     { floor: 1, cap: 6 }, intuition: { floor: 2, cap: 6 },
    willpower: { floor: 1, cap: 6 }, charisma:  { floor: 3, cap: 6 },
    luck:      { floor: 2, cap: 9 },
  },
  goblin: {
    slug: 'goblin', biosync: 6, biosyncCyberwarePenalty: 0.1,
    body:      { floor: 1, cap: 5 }, agility:   { floor: 2, cap: 8 },
    dexterity: { floor: 3, cap: 7 }, strength:  { floor: 1, cap: 5 },
    logic:     { floor: 1, cap: 5 }, intuition: { floor: 3, cap: 7 },
    willpower: { floor: 1, cap: 6 }, charisma:  { floor: 1, cap: 5 },
    luck:      { floor: 1, cap: 6 },
  },
  ork: {
    slug: 'ork', biosync: 6,
    body:      { floor: 4, cap: 8 }, agility:   { floor: 1, cap: 6 },
    dexterity: { floor: 1, cap: 5 }, strength:  { floor: 3, cap: 8 },
    logic:     { floor: 1, cap: 5 }, intuition: { floor: 1, cap: 5 },
    willpower: { floor: 3, cap: 9 }, charisma:  { floor: 1, cap: 5 },
    luck:      { floor: 1, cap: 5 },
  },
  oni: {
    slug: 'oni', biosync: 6,
    body:      { floor: 3, cap: 6 }, agility:   { floor: 2, cap: 7 },
    dexterity: { floor: 2, cap: 6 }, strength:  { floor: 1, cap: 6 },
    logic:     { floor: 1, cap: 6 }, intuition: { floor: 2, cap: 6 },
    willpower: { floor: 3, cap: 7 }, charisma:  { floor: 1, cap: 4 },
    luck:      { floor: 1, cap: 6 },
  },
  troll: {
    slug: 'troll', biosync: 6,
    body:      { floor: 3, cap: 9 }, agility:   { floor: 1, cap: 5 },
    dexterity: { floor: 2, cap: 5 }, strength:  { floor: 4, cap: 9 },
    logic:     { floor: 1, cap: 4 }, intuition: { floor: 1, cap: 4 },
    willpower: { floor: 2, cap: 6 }, charisma:  { floor: 1, cap: 5 },
    luck:      { floor: 1, cap: 5 },
  },
  minotaur: {
    slug: 'minotaur', biosync: 6,
    body:      { floor: 4, cap: 10 }, agility:   { floor: 1, cap: 4 },
    dexterity: { floor: 1, cap: 4  }, strength:  { floor: 5, cap: 11 },
    logic:     { floor: 1, cap: 4  }, intuition: { floor: 1, cap: 4  },
    willpower: { floor: 3, cap: 6  }, charisma:  { floor: 1, cap: 3  },
    luck:      { floor: 1, cap: 5  },
  },
};
