import { EcsRegistry, EntityId } from '../registry';
import { 
  ComponentTypes, 
  IdentityComponent, 
  HealthComponent, 
  PositionComponent, 
  AttributesComponent, 
  SkillsComponent,
  CombatStatusComponent,
  AiComponent,
  StunComponent,
  ManaComponent,
  ApComponent,
  NpcIdComponent,
  MobTemplateComponent
} from '../components';
import { MobTemplateRecord } from '../../../domains/combat/combat.types';
import { MAX_AP } from '../../../shared/constants';

export class MobFactory {
  static createFromTemplate(
    registry: EcsRegistry, 
    template: MobTemplateRecord, 
    roomId: string,
    aiState: AiComponent['state'] = 'idle',
  ): EntityId {
    const entityId = registry.createEntity();

    const identity: IdentityComponent = {
      name: template.name,
      slug: template.slug,
    };
    registry.addComponent(entityId, ComponentTypes.Identity, identity);

    const templateComp: MobTemplateComponent = {
      templateSlug: template.slug,
    };
    registry.addComponent(entityId, ComponentTypes.MobTemplate, templateComp);

    const npcId: NpcIdComponent = {
      mobId: entityId, // Using the ECS entity ID as the unique NPC ID
    };
    registry.addComponent(entityId, ComponentTypes.NpcId, npcId);

    const position: PositionComponent = {
      roomId,
    };
    registry.addComponent(entityId, ComponentTypes.Position, position);

    const now = Date.now();

    const health: HealthComponent = {
      current: template.maxHp,
      max: template.maxHp,
      lastRegenAt: now,
    };
    registry.addComponent(entityId, ComponentTypes.Health, health);

    const stun: StunComponent = {
      current: 0,
      max: 40, // Default NPC stun
      lastRegenAt: now,
    };
    registry.addComponent(entityId, ComponentTypes.Stun, stun);

    const mana: ManaComponent = {
      current: 0,
      max: 0,
      lastRegenAt: now,
    };
    registry.addComponent(entityId, ComponentTypes.Mana, mana);

    const ap: ApComponent = {
      current: MAX_AP,
      max: MAX_AP,
      lastRegenAt: now,
      recoveryTicks: 0,
    };
    registry.addComponent(entityId, ComponentTypes.Ap, ap);

    const attributes: AttributesComponent = {
      level: template.level,
      body: template.body,
      agility: template.agility,
      dexterity: template.dexterity,
      strength: template.strength,
      logic: template.logic,
      intuition: template.intuition,
      willpower: template.willpower,
      charisma: template.charisma,
      luck: 0,
    };
    registry.addComponent(entityId, ComponentTypes.Attributes, attributes);

    const skills: SkillsComponent = {
      masteryCQC: template.masteryCQC,
      masteryPistol: template.masteryPistol,
      masteryRifle: template.masteryRifle,
      masteryAutomatic: template.masteryAutomatic,
      armorValue: template.armorValue,
    };
    registry.addComponent(entityId, ComponentTypes.Skills, skills);

    const combatStatus: CombatStatusComponent = {
      state: 'idle',
      isPetActive: false,
    };
    registry.addComponent(entityId, ComponentTypes.CombatStatus, combatStatus);

    const ai: AiComponent = {
      state: aiState,
    };
    registry.addComponent(entityId, ComponentTypes.Ai, ai);

    return entityId;
  }
}
