import { InstanceRepository } from './instance.repository';
import type {
  ActiveInstanceAlertLevel,
  InstanceAlertLevel,
  InstanceAlertUpdateResult,
} from './mission.types';

const ALERT_LEVELS: InstanceAlertLevel[] = ['GREEN', 'YELLOW', 'RED'];

export function instanceAlertPriority(level: string): number {
  return ALERT_LEVELS.indexOf(level as InstanceAlertLevel);
}

export interface InstanceAlertView {
  instanceId: string;
  alertLevel: InstanceAlertLevel;
  alertSourceRoomId: string | null;
}

export interface ActiveInstanceAlertSource {
  instanceId: string;
  roomId: string;
  alarmState: ActiveInstanceAlertLevel;
}

export interface InstanceAlertAuthority {
  escalateAlertFromRoom(
    roomId: string,
    newLevel: ActiveInstanceAlertLevel,
  ): Promise<InstanceAlertUpdateResult>;
  ensureAlertFromRoom(
    roomId: string,
    newLevel: ActiveInstanceAlertLevel,
  ): Promise<InstanceAlertUpdateResult>;
}

export interface InstanceAlertSynchronization extends InstanceAlertAuthority {
  findActiveAlertForRoom(roomId: string): Promise<InstanceAlertView | null>;
  findActiveInstanceAlertSources(): Promise<ActiveInstanceAlertSource[]>;
}

export class InstanceAlertService implements InstanceAlertSynchronization {
  constructor(private readonly instanceRepo: InstanceRepository) {}

  async escalateAlertFromRoom(
    roomId: string,
    newLevel: ActiveInstanceAlertLevel,
  ): Promise<InstanceAlertUpdateResult> {
    const instance = await this.instanceRepo.findInstanceAlertForRoom(roomId);
    if (!instance) return 'not-in-instance';
    if (instance.status !== 'ACTIVE') return 'inactive-instance';

    const currentPriority = instanceAlertPriority(instance.alertLevel);
    const requestedPriority = instanceAlertPriority(newLevel);
    if (currentPriority > requestedPriority) return 'unchanged';
    if (currentPriority === requestedPriority && instance.alertSourceRoomId === roomId) return 'unchanged';

    if (currentPriority < requestedPriority) {
      return await this.instanceRepo.raiseInstanceAlert(
        instance.id,
        newLevel,
        roomId,
        this.lowerAlertLevels(newLevel),
      ) ? 'escalated' : 'unchanged';
    }

    return await this.instanceRepo.replaceInstanceAlertSource(instance.id, newLevel, roomId)
      ? 'source-updated'
      : 'unchanged';
  }

  async ensureAlertFromRoom(
    roomId: string,
    newLevel: ActiveInstanceAlertLevel,
  ): Promise<InstanceAlertUpdateResult> {
    const instance = await this.instanceRepo.findInstanceAlertForRoom(roomId);
    if (!instance) return 'not-in-instance';
    if (instance.status !== 'ACTIVE') return 'inactive-instance';

    const currentPriority = instanceAlertPriority(instance.alertLevel);
    const requestedPriority = instanceAlertPriority(newLevel);
    if (currentPriority > requestedPriority) return 'unchanged';
    if (currentPriority === requestedPriority && instance.alertSourceRoomId) return 'unchanged';

    if (
      currentPriority < requestedPriority
      && await this.instanceRepo.raiseInstanceAlert(
        instance.id,
        newLevel,
        roomId,
        this.lowerAlertLevels(newLevel),
      )
    ) {
      return 'escalated';
    }

    return await this.instanceRepo.claimInstanceAlertSource(instance.id, newLevel, roomId)
      ? 'source-updated'
      : 'unchanged';
  }

  async findActiveAlertForRoom(roomId: string): Promise<InstanceAlertView | null> {
    const instance = await this.instanceRepo.findInstanceAlertForRoom(roomId);
    if (!instance || instance.status !== 'ACTIVE') return null;

    return {
      instanceId: instance.id,
      alertLevel: this.isAlertLevel(instance.alertLevel) ? instance.alertLevel : 'GREEN',
      alertSourceRoomId: instance.alertSourceRoomId,
    };
  }

  async findActiveInstanceAlertSources(): Promise<ActiveInstanceAlertSource[]> {
    const instances = await this.instanceRepo.findActiveInstanceAlerts();
    return instances.flatMap((instance) => {
      if (
        !instance.alertSourceRoomId
        || (instance.alertLevel !== 'YELLOW' && instance.alertLevel !== 'RED')
      ) {
        return [];
      }
      return [{
        instanceId: instance.id,
        roomId: instance.alertSourceRoomId,
        alarmState: instance.alertLevel,
      }];
    });
  }

  private lowerAlertLevels(level: ActiveInstanceAlertLevel): InstanceAlertLevel[] {
    return level === 'RED' ? ['GREEN', 'YELLOW'] : ['GREEN'];
  }

  private isAlertLevel(level: string): level is InstanceAlertLevel {
    return ALERT_LEVELS.includes(level as InstanceAlertLevel);
  }
}
