import { CommandContext, CommandHandler } from '../command-registry';
import { MatrixService } from '../../domains/matrix/matrix.service';

export class JackOutHandler implements CommandHandler {
  readonly aliases = ['jackout'] as const;
  readonly mode = 'matrix' as const;
  readonly label = 'Jack Out';
  readonly description = 'Disconnect from the matrix node';
  readonly usage = '[fast]';

  constructor(private readonly matrixService: MatrixService) {}

  async execute(context: CommandContext): Promise<void> {
    const { characterId, accountId, args, output, message } = context;
    const isEmergency = args[0] === 'fast' || args[0] === 'emergency';
    const result = await this.matrixService.jackOut(characterId, accountId, isEmergency);
    output.emit('matrix_data', null);
    message(result.message, isEmergency ? 'error' : 'success');
  }
}
