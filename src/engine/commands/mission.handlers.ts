import { MissionService } from '../../domains/mission/mission.service';
import { WorldService } from '../../domains/world/world.service';
import { CommandContext, CommandHandler } from '../command-registry';
import { PlayerRuntime } from '../player-runtime';
import { SocketHub } from '../socket-hub';

export class MissionListHandler implements CommandHandler {
  readonly aliases = ['missions'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Missions';
  readonly description = 'List available Mission contracts';

  constructor(private readonly missionService: MissionService) {}

  async execute(context: CommandContext): Promise<void> {
    const missions = await this.missionService.listAvailableMissions(context.characterId, context.accountId);
    if (missions.length === 0) {
      context.message('No Mission contracts are available.');
      return;
    }
    context.message(missions
      .map((mission) => `${mission.slug}: ${mission.name} — ${mission.basePayout}¥`)
      .join('\n'));
  }
}

export class AcceptMissionHandler implements CommandHandler {
  readonly aliases = ['accept'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Accept Mission';
  readonly description = 'Accept a Mission contract';
  readonly usage = '<mission>';
  readonly argumentSource = 'mission' as const;

  constructor(private readonly missionService: MissionService) {}

  async execute(context: CommandContext): Promise<void> {
    const templateSlug = context.args[0];
    if (!templateSlug) {
      context.message('Usage: accept <mission>', 'error');
      return;
    }
    const result = await this.missionService.acceptMission({
      templateSlug,
      characterId: context.characterId,
      accountId: context.accountId,
    });
    context.message(`${result.message} Use deploy when ready.`, 'success');
  }
}

export class MissionStatusHandler implements CommandHandler {
  readonly aliases = ['mission'] as const;
  readonly mode = 'any' as const;
  readonly label = 'Mission Status';
  readonly description = 'Show the active Mission and objective progress';

  constructor(private readonly missionService: MissionService) {}

  async execute(context: CommandContext): Promise<void> {
    const mission = await this.missionService.getActiveMission(context.characterId, context.accountId);
    if (!mission) {
      context.message('You have no active Mission.');
      return;
    }
    const objectives = mission.objectives
      .map((objective) => `${objective.isCompleted ? '[x]' : '[ ]'} ${objective.description}`)
      .join('\n');
    context.message(`${mission.name} — ${mission.alertLevel}\n${objectives}`);
  }
}

export class DeployMissionHandler implements CommandHandler {
  readonly aliases = ['deploy'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Deploy';
  readonly description = 'Enter your active Mission Instance';

  constructor(
    private readonly missionService: MissionService,
    private readonly worldService: WorldService,
    private readonly socketHub: SocketHub,
    private readonly playerRuntime: PlayerRuntime,
  ) {}

  async execute(context: CommandContext): Promise<void> {
    const deployment = await this.missionService.deployMission(context.characterId, context.accountId);
    const room = await this.worldService.getRoom(deployment.room.id);
    this.playerRuntime.moveCharacter(context.characterId, room.id);
    this.socketHub.moveCharacter(context.characterId, room.id);
    const occupants = this.socketHub.getRoomOccupants(room.id).filter((occupant) => occupant.characterId !== context.characterId);
    context.output.emit('room_data', { ...room, occupants });
    context.output.emit('local_pois', []);
    context.message(`Deployed to ${room.name}.`, 'success');
  }
}

export class ExfilMissionHandler implements CommandHandler {
  readonly aliases = ['exfil'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Exfil';
  readonly description = 'Complete and extract from your active Mission';

  constructor(
    private readonly missionService: MissionService,
    private readonly worldService: WorldService,
    private readonly socketHub: SocketHub,
    private readonly playerRuntime: PlayerRuntime,
  ) {}

  async execute(context: CommandContext): Promise<void> {
    const mission = await this.missionService.getMissionForExfil(context.characterId, context.accountId);
    if (!mission) {
      context.message('You have no active Mission.', 'error');
      return;
    }
    const result = await this.missionService.completeMission(
      context.characterId,
      context.accountId,
      mission.missionId,
    );
    if (result.extractionRoom) {
      const room = await this.worldService.getRoom(result.extractionRoom.id);
      this.playerRuntime.moveCharacter(context.characterId, room.id);
      this.socketHub.moveCharacter(context.characterId, room.id);
      const occupants = this.socketHub.getRoomOccupants(room.id).filter((occupant) => occupant.characterId !== context.characterId);
      context.output.emit('room_data', { ...room, occupants });
      context.output.emit('local_pois', await this.worldService.getPOIs(room.zoneId));
      context.output.emit('character_update', { nuyen: result.nuyenTotal, currentRoomId: room.id });
    }
    context.message(result.message, 'success');
  }
}
