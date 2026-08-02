import { InstanceRepository } from './instance.repository';
import type { InstanceAlertUpdateResult } from './mission.types';

export interface InstanceAlertAuthority {
  escalateAlertFromRoom(roomId: string, newLevel: string): Promise<InstanceAlertUpdateResult>;
  ensureAlertFromRoom(roomId: string, newLevel: string): Promise<InstanceAlertUpdateResult>;
}

export class InstanceAlertService implements InstanceAlertAuthority {
  constructor(private readonly instanceRepo: InstanceRepository) {}

  escalateAlertFromRoom(roomId: string, newLevel: string): Promise<InstanceAlertUpdateResult> {
    return this.instanceRepo.escalateAlertFromRoom(roomId, newLevel);
  }

  ensureAlertFromRoom(roomId: string, newLevel: string): Promise<InstanceAlertUpdateResult> {
    return this.instanceRepo.ensureAlertFromRoom(roomId, newLevel);
  }

  findInstanceByRoomId(roomId: string): ReturnType<InstanceRepository['findInstanceByRoomId']> {
    return this.instanceRepo.findInstanceByRoomId(roomId);
  }

  findActiveInstanceAlertSources(): ReturnType<InstanceRepository['findActiveInstanceAlertSources']> {
    return this.instanceRepo.findActiveInstanceAlertSources();
  }
}
