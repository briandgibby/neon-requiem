import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, CombatSessionComponent, ApComponent, CombatStatusComponent, PlayerIdComponent } from '../components';
import { COMMAND_AP_PENALTY } from '../../../shared/constants';
import { CharacterUpdatePublisher } from '../../character-update-publisher';

export class CombatTickSystem implements Tickable {
  readonly name = 'ecs_combat_tick_system';
  readonly frequency = 1; // Ticks every heartbeat

  constructor(
    private readonly registry: EcsRegistry,
    private readonly characterUpdates?: CharacterUpdatePublisher,
  ) {}

  async onTick(_tickCount: number): Promise<void> {
    this.updateSessions();
    this.updateRecovery();
  }

  private updateSessions(): void {
    const sessionIds = this.registry.getEntitiesWith([ComponentTypes.CombatSession]);

    for (const sessionId of sessionIds) {
      const session = this.registry.getComponent<CombatSessionComponent>(sessionId, ComponentTypes.CombatSession);
      if (!session) continue;

      session.tick++;

      if (session.backupCalled && session.turnsUntilReinforcements !== null) {
        if (session.turnsUntilReinforcements > 0) {
          session.turnsUntilReinforcements--;
        }
      }
    }
  }

  private updateRecovery(): void {
    const entities = this.registry.getEntitiesWith([ComponentTypes.Ap, ComponentTypes.CombatStatus]);

    for (const entityId of entities) {
      const ap = this.registry.getComponent<ApComponent>(entityId, ComponentTypes.Ap);
      const status = this.registry.getComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus);

      if (!ap || !status) continue;

      if (status.state === 'recovering') {
        ap.recoveryTicks--;
        if (ap.recoveryTicks <= 0) {
          status.state = 'engaged';
          ap.current = ap.max;
          if (status.isPetActive) {
            ap.current -= COMMAND_AP_PENALTY;
          }
          const player = this.registry.getComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId);
          if (player) {
            try {
              this.characterUpdates?.publish(player.characterId, {
                currentAp: ap.current,
                maxAp: ap.max,
              });
            } catch (_err) {
              // Realtime output must not interrupt combat recovery.
            }
          }
        }
      }
    }
  }
}
