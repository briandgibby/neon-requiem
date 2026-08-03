import { RuntimeCharacterData } from '../../src/engine/player-runtime';

export function runtimeCharacter(
  id: string,
  accountId: string,
  name: string,
  className: string,
  currentHp: number,
): RuntimeCharacterData {
  return {
    id,
    accountId,
    name,
    className,
    currentHp,
    maxHp: 100,
    currentStun: 100,
    maxStun: 100,
    currentMana: 60,
    maxMana: 100,
    currentAp: 6,
    apRecoveryTicks: 0,
    level: 1,
    body: 3,
    agility: 3,
    dexterity: 3,
    strength: 3,
    logic: 5,
    intuition: 3,
    willpower: 3,
    charisma: 3,
    luck: 3,
    masteryCQC: 0,
    masteryPistol: 0,
    masteryRifle: 0,
    masteryAutomatic: 0,
    armorValue: 0,
  };
}
