import { PrismaClient } from '@prisma/client';
import { EcsRegistry } from './ecs/registry';
import { 
  ComponentTypes, 
  PlayerIdComponent, 
  HealthComponent, 
  StunComponent, 
  ManaComponent, 
  PositionComponent,
  ApComponent,
  DeckerComponent,
} from './ecs/components';
import { AuditLogger } from './audit-logger';

export class PlayerSyncCoordinator {
  private readonly pendingDisconnects = new Map<string, Promise<void>>();

  constructor(
    private readonly db: PrismaClient,
    private readonly registry: EcsRegistry,
    private readonly auditLogger: AuditLogger
  ) {}

  /**
   * Safe disconnection flow: 
   * 1. Snapshot ECS state
   * 2. Persist to DB via Transaction
   * 3. Confirm & Destroy Entity
   */
  handlePlayerDisconnect(characterId: string): Promise<void> {
    const pending = this.pendingDisconnects.get(characterId);
    if (pending) return pending;

    const operation = this.persistAndDestroyPlayer(characterId);
    this.pendingDisconnects.set(characterId, operation);
    const clearPending = () => {
      if (this.pendingDisconnects.get(characterId) === operation) {
        this.pendingDisconnects.delete(characterId);
      }
    };
    void operation.then(clearPending, clearPending);
    return operation;
  }

  waitForPlayerDisconnect(characterId: string): Promise<void> {
    return this.pendingDisconnects.get(characterId) ?? Promise.resolve();
  }

  private async persistAndDestroyPlayer(characterId: string): Promise<void> {
    const entityId = this.registry.getEntityByComponent<PlayerIdComponent>(
      ComponentTypes.PlayerId,
      (p) => p.characterId === characterId
    );

    if (!entityId) return;

    try {
      // 1. Create Immutable Snapshot
      const snapshot = this.createSnapshot(entityId);
      if (!snapshot) return;

      // 2. Perform Atomic Database Transaction
      await this.db.$transaction(async (tx) => {
        await tx.character.update({
          where: { id: characterId },
          data: {
            currentHp: snapshot.hp,
            currentStun: snapshot.stun,
            currentMana: snapshot.mana,
            currentRoomId: snapshot.roomId,
            ...(snapshot.currentAp !== undefined ? { currentAp: snapshot.currentAp } : {}),
            ...(snapshot.apRecoveryTicks !== undefined ? { apRecoveryTicks: snapshot.apRecoveryTicks } : {}),
            ...(snapshot.matrixOverwatchScore !== undefined
              ? { matrixOverwatchScore: snapshot.matrixOverwatchScore }
              : {}),
          },
        });

        // Log the final snapshot state in the same transaction as the write.
        await tx.auditLog.create({
          data: {
            category: 'PLAYER_SNAPSHOT',
            severity: 'INFO',
            message: `Player ${characterId} disconnected. Final state persisted.`,
            characterId,
            metadata: { snapshot }
          }
        });
      });

      // 3. ONLY ON SUCCESS: Destroy Entity from Memory
      this.registry.destroyEntity(entityId);

    } catch (err: any) {
      // If DB transaction fails, we DO NOT delete the entity.
      // It remains in ECS (quarantined) for retry or manual recovery.
      await this.auditLogger.log({
        category: 'EXPLOIT_FLAG',
        severity: 'CRITICAL',
        message: `FAILED TO PERSIST PLAYER DISCONNECT: ${characterId}. Entity kept in memory.`,
        characterId,
        metadata: { error: err.message }
      });
      throw err;
    }
  }

  private createSnapshot(entityId: string) {
    const health = this.registry.getComponent<HealthComponent>(entityId, ComponentTypes.Health);
    const stun = this.registry.getComponent<StunComponent>(entityId, ComponentTypes.Stun);
    const mana = this.registry.getComponent<ManaComponent>(entityId, ComponentTypes.Mana);
    const pos = this.registry.getComponent<PositionComponent>(entityId, ComponentTypes.Position);
    const ap = this.registry.getComponent<ApComponent>(entityId, ComponentTypes.Ap);
    const decker = this.registry.getComponent<DeckerComponent>(entityId, ComponentTypes.Decker);

    if (!health || !pos) return null;

    return {
      hp: health.current,
      stun: stun?.current || 0,
      mana: mana?.current || 0,
      roomId: pos.roomId,
      timestamp: Date.now(),
      ...(ap ? { currentAp: ap.current } : {}),
      ...(ap ? { apRecoveryTicks: ap.recoveryTicks } : {}),
      ...(decker ? { matrixOverwatchScore: decker.overwatchScore } : {}),
    };
  }

  /**
   * Periodic bulk sync (Heartbeat level)
   */
  async syncAllPlayers(): Promise<void> {
    const playerEntities = this.registry.getEntitiesWith([ComponentTypes.PlayerId]);
    
    // Process in parallel for performance during heartbeat
    await Promise.all(playerEntities.map(async (entityId) => {
      const playerId = this.registry.getComponent<PlayerIdComponent>(entityId, ComponentTypes.PlayerId);
      if (!playerId) return;

      const snapshot = this.createSnapshot(entityId);
      if (!snapshot) return;

      await this.db.character.update({
        where: { id: playerId.characterId },
        data: {
          currentHp: snapshot.hp,
          currentStun: snapshot.stun,
          currentMana: snapshot.mana,
          ...(snapshot.currentAp !== undefined ? { currentAp: snapshot.currentAp } : {}),
          ...(snapshot.apRecoveryTicks !== undefined ? { apRecoveryTicks: snapshot.apRecoveryTicks } : {}),
          ...(snapshot.matrixOverwatchScore !== undefined
            ? { matrixOverwatchScore: snapshot.matrixOverwatchScore }
            : {}),
        }
      });
    }));
  }
}
