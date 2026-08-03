import { EcsRegistry } from '../registry';
import { Tickable } from '../../heartbeat';
import { ComponentTypes, HealthComponent, NpcIdComponent, CombatSessionComponent, MatrixNodeComponent, DeckerComponent, CombatStatusComponent, MissionTargetComponent } from '../components';

export class EntityCleanupSystem implements Tickable {
  readonly name = 'ecs_entity_cleanup_system';
  readonly frequency = 20; // Run every 20 ticks

  constructor(private readonly registry: EcsRegistry) {}

  async onTick(_tickCount: number): Promise<void> {
    this.cleanupDeadNpcs();
    this.cleanupEmptyCombatSessions();
    this.cleanupAbandonedMatrixNodes();
  }

  private cleanupDeadNpcs(): void {
    const npcIds = this.registry.getEntitiesWith([ComponentTypes.Health, ComponentTypes.NpcId]);

    for (const npcId of npcIds) {
      const health = this.registry.getComponent<HealthComponent>(npcId, ComponentTypes.Health);
      if (health && health.current <= 0) {
        const missionTarget = this.registry.getComponent<MissionTargetComponent>(npcId, ComponentTypes.MissionTarget);
        if (missionTarget && !missionTarget.isCompleted) continue;
        // NPC is dead. In a fuller system, we'd trigger loot drops here.
        this.registry.destroyEntity(npcId);
      }
    }
  }

  private cleanupEmptyCombatSessions(): void {
    const sessionIds = this.registry.getEntitiesWith([ComponentTypes.CombatSession]);
    const allParticipants = this.registry.getEntitiesWith([ComponentTypes.CombatStatus]);

    for (const sessionId of sessionIds) {
      // Check if any entity is currently linked to this session
      const hasActiveParticipants = allParticipants.some(entityId => {
        const status = this.registry.getComponent<CombatStatusComponent>(entityId, ComponentTypes.CombatStatus);
        return status?.sessionId === sessionId;
      });

      if (!hasActiveParticipants) {
        this.registry.destroyEntity(sessionId);
      }
    }
  }

  private cleanupAbandonedMatrixNodes(): void {
    const nodeIds = this.registry.getEntitiesWith([ComponentTypes.MatrixNode]);
    const deckers = this.registry.getEntitiesWith([ComponentTypes.Decker]);

    for (const nodeId of nodeIds) {
       const isAbandoned = !deckers.some(deckerId => {
          const decker = this.registry.getComponent<DeckerComponent>(deckerId, ComponentTypes.Decker);
          return decker?.activeNodeEntityId === nodeId;
       });

       if (isAbandoned) {
          // Also cleanup any ICE that belong to this node
          this.cleanupIceInNode(nodeId);
          this.registry.destroyEntity(nodeId);
       }
    }
  }

  private cleanupIceInNode(nodeId: string): void {
     const iceIds = this.registry.getEntitiesWith([ComponentTypes.Ice, ComponentTypes.Position]);
     for (const iceId of iceIds) {
        const pos = this.registry.getComponent<any>(iceId, ComponentTypes.Position);
        if (pos?.roomId === nodeId) {
           this.registry.destroyEntity(iceId);
        }
     }
  }
}
