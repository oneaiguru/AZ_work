import { Injectable, Logger } from '@nestjs/common';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { ChatOllama } from 'langchain/chat_models/ollama';
import { AgentExecutor } from 'langchain/agents';
import { ToolFactory } from './tool.factory';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly toolFactory: ToolFactory) {}

  private resolveTemperature(): number {
    const raw = process.env.OLLAMA_TEMPERATURE;
    if (!raw) {
      return 0;
    }

    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) {
      throw new Error('OLLAMA_TEMPERATURE must be a valid number if provided.');
    }

    return parsed;
  }

  private createModel() {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL ?? 'yandex-gpt-lite';
    const temperature = this.resolveTemperature();

    return new ChatOllama({
      baseUrl,
      model,
      temperature,
    });
  }

  private async createExecutor(context?: Record<string, unknown>): Promise<AgentExecutor> {
    const model = this.createModel();
    const tools = this.toolFactory.createTools(context);

    return initializeAgentExecutorWithOptions(tools, model, {
      agentType: 'zero-shot-react-description',
      returnIntermediateSteps: true,
    });
  }

  async run(prompt: string, context?: Record<string, unknown>) {
    this.logger.debug(`Running LangChain agent with prompt: ${prompt}`);
    const executor = await this.createExecutor(context);
    const response = await executor.invoke({ input: prompt, context });

    return {
      output: response.output,
      intermediateSteps: response.intermediateSteps,
    };
  }
}
