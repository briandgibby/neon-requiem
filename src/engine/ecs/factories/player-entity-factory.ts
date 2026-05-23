import { EcsRegistry, EntityId } from '../registry';
import {
  ComponentTypes,
  IdentityComponent,
  PositionComponent,
  HealthComponent,
  StunComponent,
  ManaComponent,
  AttributesComponent,
  SkillsComponent,
  PlayerIdComponent,
  CharacterClassComponent,
} from '../components';

export interface PlayerCharacterData {
  id: string;
  accountId: string;
  name: string;
  className: string;
  currentHp: number;
  maxHp: number;
  currentStun: number;
  maxStun: number;
  currentMana: number;
  maxMana: number;
  level: number;
  body: number;
  agility: number;
  dexterity: number;
  strength: number;
  logic: number;
  intuition: number;
  willpower: number;
  charisma: number;
  luck: number;
  masteryCQC: number;
  masteryPistol: number;
  masteryRifle: number;
  masteryAutomatic: number;
  armorValue: number;
}

export class PlayerEntityFactory {
  static createFromRecord(
    registry: EcsRegistry,
    character: PlayerCharacterData,
    roomId: string,
  ): EntityId {
    const entityId = registry.createEntity();
    const now = Date.now();

    registry.addComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId, {
      characterId: character.id,
      accountId: character.accountId,
    });

    registry.addComponent<IdentityComponent>(entityId, ComponentTypes.Identity, {
      name: character.name,
      slug: character.name.toLowerCase().replace(/\s+/g, '-'),
    });

    registry.addComponent<PositionComponent>(entityId, ComponentTypes.Position, {
      roomId,
    });

    registry.addComponent<HealthComponent>(entityId, ComponentTypes.Health, {
      current: character.currentHp,
      max: character.maxHp,
      lastRegenAt: now,
    });

    registry.addComponent<StunComponent>(entityId, ComponentTypes.Stun, {
      current: character.currentStun,
      max: character.maxStun,
      lastRegenAt: now,
    });

    registry.addComponent<ManaComponent>(entityId, ComponentTypes.Mana, {
      current: character.currentMana,
      max: character.maxMana,
      lastRegenAt: now,
    });

    registry.addComponent<AttributesComponent>(entityId, ComponentTypes.Attributes, {
      level: character.level,
      body: character.body,
      agility: character.agility,
      dexterity: character.dexterity,
      strength: character.strength,
      logic: character.logic,
      intuition: character.intuition,
      willpower: character.willpower,
      charisma: character.charisma,
      luck: character.luck,
    });

    registry.addComponent<SkillsComponent>(entityId, ComponentTypes.Skills, {
      masteryCQC: character.masteryCQC,
      masteryPistol: character.masteryPistol,
      masteryRifle: character.masteryRifle,
      masteryAutomatic: character.masteryAutomatic,
      armorValue: character.armorValue,
    });

    registry.addComponent<CharacterClassComponent>(entityId, ComponentTypes.CharacterClass, {
      className: character.className,
    });

    return entityId;
  }
}
