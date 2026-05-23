import { CommandContext, CommandHandler } from '../command-registry';
import { MatrixService } from '../../domains/matrix/matrix.service';

export class BruteHandler implements CommandHandler {
  readonly aliases = ['brute'] as const;
  readonly mode = 'matrix' as const;
  readonly label = 'Brute Force';
  readonly description = 'Attempt to breach the node with direct force';

  constructor(private readonly matrixService: MatrixService) {}

  async execute(context: CommandContext): Promise<void> {
    const { characterId, accountId, output, message } = context;
    const result = await this.matrixService.performHacking(characterId, accountId, 'brute');
    message(result.message, result.success ? 'success' : 'error');
    const activeNode = await this.matrixService.getActiveNode(characterId, accountId);
    if (activeNode) output.emit('matrix_data', activeNode);
  }
}
