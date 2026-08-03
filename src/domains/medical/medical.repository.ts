import { Prisma, PrismaClient } from '@prisma/client';
import { CharacterWithInventory, TreatmentCommitInput, TreatmentCommitResult } from './medical.types';
import { NotFoundError, ValidationError } from '../../shared/errors';

export class MedicalRepository {
  constructor(private readonly db: PrismaClient) {}

  async findCharacterById(id: string): Promise<CharacterWithInventory | null> {
    return this.db.character.findUnique({
      where: { id },
      include: {
        inventory: {
          include: { item: true }
        }
      }
    }) as Promise<CharacterWithInventory | null>;
  }

  async findTreatmentActor(id: string, accountId: string): Promise<CharacterWithInventory | null> {
    return this.db.character.findFirst({
      where: { id, accountId },
      include: {
        inventory: {
          include: { item: true },
        },
      },
    }) as Promise<CharacterWithInventory | null>;
  }

  async findTreatmentTarget(id: string): Promise<Pick<CharacterWithInventory, 'id' | 'currentHp'> | null> {
    return this.db.character.findUnique({
      where: { id },
      select: { id: true, currentHp: true },
    });
  }

  async updateCharacterVitals(
    id: string, 
    data: { 
      currentHp?: number; 
      currentStun?: number; 
      currentMana?: number;
      luck?: number;
      deathSicknessUntil?: Date | null;
    }
  ) {
    return this.db.character.update({
      where: { id },
      data
    });
  }

  async consumeInventoryItem(inventoryItemId: string, quantity: number = 1) {
    const item = await this.db.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!item) return;

    if (item.quantity <= quantity) {
      return this.db.inventoryItem.delete({ where: { id: inventoryItemId } });
    }

    return this.db.inventoryItem.update({
      where: { id: inventoryItemId },
      data: { quantity: item.quantity - quantity }
    });
  }

  async findNPC(id: string) {
    // NPCs will be in the Character table for now, or a separate NPC table
    return this.db.character.findUnique({ where: { id } });
  }

  async commitTreatment(input: TreatmentCommitInput): Promise<TreatmentCommitResult> {
    return this.db.$transaction(async (tx) => {
      const doctor = await tx.character.findFirst({
        where: { id: input.doctorId, accountId: input.accountId },
      });
      if (!doctor) throw new NotFoundError('Doctor');
      if (doctor.currentRoomId !== input.roomId) {
        throw new ValidationError('Doctor is no longer in the treatment room');
      }
      const target = await tx.character.findUnique({ where: { id: input.targetCharacterId } });
      if (!target) throw new NotFoundError('Target');
      if (target.currentRoomId !== input.roomId) {
        throw new ValidationError('Target is no longer in the treatment room');
      }
      let resourceSpent: 'MANA' | 'SUPPLIES';

      if (input.resource.type === 'mana') {
        const spend = await tx.character.updateMany({
          where: {
            id: doctor.id,
            accountId: input.accountId,
            className: 'street-doc',
            streetDocPath: 'magic',
            currentRoomId: input.roomId,
            currentMana: { gte: input.resource.amount },
          },
          data: { currentMana: { decrement: input.resource.amount } },
        });
        if (spend.count !== 1) throw new ValidationError('Insufficient Mana');
        resourceSpent = 'MANA';
      } else {
        const actorGuard = await tx.character.updateMany({
          where: {
            id: doctor.id,
            accountId: input.accountId,
            className: 'street-doc',
            streetDocPath: 'tech',
            currentRoomId: input.roomId,
          },
          data: { currentMana: { increment: 0 } },
        });
        if (actorGuard.count !== 1) {
          throw new ValidationError('Street Doc treatment state changed');
        }
        const spend = await tx.inventoryItem.updateMany({
          where: {
            id: input.resource.inventoryItemId,
            characterId: doctor.id,
            quantity: { gte: input.resource.quantity },
          },
          data: { quantity: { decrement: input.resource.quantity } },
        });
        if (spend.count !== 1) throw new ValidationError('Insufficient Medical Supplies');
        await tx.inventoryItem.deleteMany({
          where: { id: input.resource.inventoryItemId, quantity: { lte: 0 } },
        });
        resourceSpent = 'SUPPLIES';
      }

      const targetUpdate = await tx.character.updateMany({
        where: {
          id: target.id,
          currentRoomId: input.roomId,
          currentHp: input.expectedCurrentHp,
        },
        data: { currentHp: input.targetNextHp },
      });
      if (targetUpdate.count !== 1) {
        throw new ValidationError('Target health or location changed before treatment completed');
      }
      const actorAfterSpend = await tx.character.findUniqueOrThrow({
        where: { id: doctor.id },
        select: { currentMana: true },
      });
      await tx.auditLog.create({
        data: {
          category: 'MEDICAL_TREATMENT',
          severity: 'INFO',
          message: `${doctor.name} treated ${target.name} for ${input.hpRestored} HP`,
          characterId: doctor.id,
          metadata: {
            targetCharacterId: target.id,
            hpRestored: input.hpRestored,
            resourceSpent,
          },
        },
      });

      return {
        targetName: target.name,
        actorCurrentMana: actorAfterSpend.currentMana,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
