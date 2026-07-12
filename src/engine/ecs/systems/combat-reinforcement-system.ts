import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, CombatSessionComponent } from '../components';
import { MobFactory } from '../factories/mob-factory';
import { MobTemplateRecord } from '../../../domains/combat/combat.types';
import { RoomLookup, SafeZonePolicy } from '../../../domains/world/world.types';

interface ReinforcementWorldPolicy extends SafeZonePolicy, RoomLookup {}

export interface ReinforcementMobCatalog {
  findMobTemplateBySlug(slug: string): Promise<MobTemplateRecord | null>;
  findEliteMobTemplateByCorporation(corporationId: string): Promise<MobTemplateRecord | null>;
}

export class CombatReinforcementSystem implements Tickable {
  readonly name = 'ecs_combat_reinforcement_system';
  readonly frequency = 1;

  constructor(
    private readonly registry: EcsRegistry,
    private readonly mobCatalog: ReinforcementMobCatalog,
    private readonly worldPolicy: ReinforcementWorldPolicy
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    const sessionIds = this.registry.getEntitiesWith([ComponentTypes.CombatSession]);

    for (const sessionId of sessionIds) {
      const session = this.registry.getComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession);
      if (!session) continue;

      if (session.backupCalled && session.turnsUntilReinforcements === 0) {
        const isSafeZone = await this.worldPolicy.isEffectiveSafeZone(session.roomId);
        if (isSafeZone) {
          session.turnsUntilReinforcements = null;
          continue;
        }

        // Trigger spawn
        await this.spawnReinforcements(session, sessionId);
        session.turnsUntilReinforcements = null; // Reset
      }
    }
  }

  private async spawnReinforcements(session: CombatSessionComponent, sessionId: string): Promise<void> {
    const template = await this.mobCatalog.findMobTemplateBySlug('security-guard');
    if (!template) return;

    this.spawnTemplate(template, session.roomId, sessionId);

    if (session.alarmState === 'RED') {
      await this.spawnEliteReinforcement(session, sessionId);
    }

    session.alarmState = 'RED';
  }

  private spawnTemplate(template: any, roomId: string, sessionId: string): void {
    const entityId = MobFactory.createFromTemplate(this.registry, template, roomId, 'hostile');

    // Link to session
    const status = this.registry.getComponent<any>(entityId, ComponentTypes.CombatStatus);
    if (status) {
      status.sessionId = sessionId;
      status.state = 'engaged';
    }
  }

  private async spawnEliteReinforcement(session: CombatSessionComponent, sessionId: string): Promise<void> {
    const room = await this.worldPolicy.getRoom(session.roomId);
    const corporationId = room.factionOwner;
    if (!corporationId) return;

    const template = await this.mobCatalog.findEliteMobTemplateByCorporation(corporationId);
    if (!template) return;

    this.spawnTemplate(template, session.roomId, sessionId);
  }
}
