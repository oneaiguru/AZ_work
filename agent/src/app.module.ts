import { Module } from '@nestjs/common';
import { AgentController } from './controller/agent.controller';
import { AgentService } from './services/agent.service';
import { ToolFactory } from './services/tool.factory';

@Module({
  controllers: [AgentController],
  providers: [AgentService, ToolFactory],
})
export class AppModule {}
