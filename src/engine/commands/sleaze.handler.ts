import { CommandContext, CommandHandler } from '../command-registry';
import { MatrixService } from '../../domains/matrix/matrix.service';

export class SleazeHandler implements CommandHandler {
  readonly aliases = ['sleaze'] as const;
  readonly mode = 'matrix' as const;
  readonly label = 'Sleaze';
  readonly description = 'Attempt to infiltrate the node without triggering alerts';

  constructor(private readonly matrixService: MatrixService) {}

  async execute(context: CommandContext): Promise<void> {
    const { characterId, accountId, output, message } = context;
    const result = await this.matrixService.performHacking(characterId, accountId, 'sleaze');
    message(result.message, result.success ? 'success' : 'error');
    const activeNode = await this.matrixService.getActiveNode(characterId, accountId);
    if (activeNode) output.emit('matrix_data', activeNode);
  }
}
