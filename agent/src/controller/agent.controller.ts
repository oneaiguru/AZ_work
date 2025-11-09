import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { AgentService } from '../services/agent.service';
import { RunAgentDto } from '../dto/run-agent.dto';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('run')
  async runAgent(@Body() body: RunAgentDto) {
    try {
      const result = await this.agentService.run(body.prompt, body.context);
      return { result };
    } catch (error) {
      throw new HttpException(
        {
          message: 'Agent execution failed',
          error: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
