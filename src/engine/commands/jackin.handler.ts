import { CommandContext, CommandHandler } from '../command-registry';
import { MatrixService } from '../../domains/matrix/matrix.service';

export class JackInHandler implements CommandHandler {
  readonly aliases = ['jackin'] as const;
  readonly mode = 'physical' as const;
  readonly label = 'Jack In';
  readonly description = 'Connect your neural link to the local matrix node';

  constructor(private readonly matrixService: MatrixService) {}

  async execute(context: CommandContext): Promise<void> {
    const { characterId, accountId, roomId, output, message } = context;
    const result = await this.matrixService.jackIn(characterId, accountId, roomId);
    output.emit('matrix_data', result.node);
    message(result.message, 'success');
  }
}
