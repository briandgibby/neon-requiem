import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, CombatSessionComponent } from '../components';
import { MobRepository } from '../../../domains/combat/mob.repository';
import { MobFactory } from '../factories/mob-factory';
import { SafeZonePolicy } from '../../../domains/world/world.types';

export class CombatReinforcementSystem implements Tickable {
  readonly name = 'ecs_combat_reinforcement_system';
  readonly frequency = 1;

  constructor(
    private readonly registry: EcsRegistry,
    private readonly mobRepo: MobRepository,
    private readonly safeZonePolicy: SafeZonePolicy
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    const sessionIds = this.registry.getEntitiesWith([ComponentTypes.CombatSession]);

    for (const sessionId of sessionIds) {
      const session = this.registry.getComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession);
      if (!session) continue;

      if (session.backupCalled && session.turnsUntilReinforcements === 0) {
        const isSafeZone = await this.safeZonePolicy.isEffectiveSafeZone(session.roomId);
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
    const template = await this.mobRepo.findBySlug('security-guard');
    if (!template) return;

    const entityId = MobFactory.createFromTemplate(this.registry, template, session.roomId, 'hostile');

    // Link to session
    const status = this.registry.getComponent<any>(entityId, ComponentTypes.CombatStatus);
    if (status) {
      status.sessionId = sessionId;
      status.state = 'engaged';
    }

    session.alarmState = 'RED';
  }
}
