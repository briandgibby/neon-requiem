import { CommandContext, CommandHandler } from '../command-registry';
import { MatrixService } from '../../domains/matrix/matrix.service';

export class DataSpikeHandler implements CommandHandler {
  readonly aliases = ['spike'] as const;
  readonly mode = 'matrix' as const;
  readonly label = 'Data Spike';
  readonly description = 'Attack an ICE program with a focused data spike';
  readonly usage = '<ice-id>';
  readonly argumentSource = 'ice' as const;

  constructor(private readonly matrixService: MatrixService) {}

  async execute(context: CommandContext): Promise<void> {
    const { characterId, accountId, args, output, message } = context;
    const targetId = args[0];
    if (!targetId) {
      message('Usage: data spike <ice-id>');
      return;
    }
    const result = await this.matrixService.dataSpike(characterId, accountId, targetId);
    message(result.message, result.success ? 'success' : 'error');
    const activeNode = await this.matrixService.getActiveNode(characterId, accountId);
    if (activeNode) output.emit('matrix_data', activeNode);
  }
}
