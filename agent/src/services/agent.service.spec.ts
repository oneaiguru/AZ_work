import { Logger } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ToolFactory } from './tool.factory';

describe('AgentService', () => {
  let service: AgentService;
  let toolFactory: ToolFactory;
  const mockInvoke = jest.fn();
  const { initializeAgentExecutorWithOptions } = jest.requireMock('langchain/agents') as {
    initializeAgentExecutorWithOptions: jest.Mock;
  };
  const { ChatOllama } = jest.requireMock('langchain/chat_models/ollama') as {
    ChatOllama: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockReset();
    initializeAgentExecutorWithOptions.mockResolvedValue({ invoke: mockInvoke });

    toolFactory = { createTools: jest.fn().mockReturnValue(['tools']) } as unknown as ToolFactory;
    service = new AgentService(toolFactory);
    process.env.OLLAMA_BASE_URL = 'http://ollama:11434';
    process.env.OLLAMA_MODEL = 'yandex-lite';
    process.env.OLLAMA_TEMPERATURE = '0.2';
  });

  afterEach(() => {
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_MODEL;
    delete process.env.OLLAMA_TEMPERATURE;
  });

  it('runs the agent and returns executor response', async () => {
    mockInvoke.mockResolvedValueOnce({
      output: 'answer',
      intermediateSteps: ['step1'],
    });

    const result = await service.run('prompt', { foo: 'bar' });

    expect(ChatOllama).toHaveBeenCalledWith({
      baseUrl: 'http://ollama:11434',
      model: 'yandex-lite',
      temperature: 0.2,
    });
    expect(toolFactory.createTools).toHaveBeenCalledWith({ foo: 'bar' });
    expect(initializeAgentExecutorWithOptions).toHaveBeenCalledWith(
      ['tools'],
      ChatOllama.mock.instances[0],
      {
        agentType: 'zero-shot-react-description',
        returnIntermediateSteps: true,
      },
    );
    expect(mockInvoke).toHaveBeenCalledWith({ input: 'prompt', context: { foo: 'bar' } });
    expect(result).toEqual({
      output: 'answer',
      intermediateSteps: ['step1'],
    });
  });

  it('uses default model when none is provided', async () => {
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_MODEL;
    delete process.env.OLLAMA_TEMPERATURE;

    mockInvoke.mockResolvedValueOnce({ output: 'done', intermediateSteps: [] });

    await service.run('prompt');

    expect(ChatOllama).toHaveBeenCalledWith({
      baseUrl: 'http://localhost:11434',
      model: 'yandex-gpt-lite',
      temperature: 0,
    });
  });

  it('throws a descriptive error when the temperature is invalid', async () => {
    process.env.OLLAMA_TEMPERATURE = 'not-a-number';

    await expect(service.run('prompt')).rejects.toThrow(
      'OLLAMA_TEMPERATURE must be a valid number if provided.',
    );
  });

  it('logs the prompt when running', async () => {
    mockInvoke.mockResolvedValueOnce({ output: 'done', intermediateSteps: [] });
    const loggerSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    await service.run('prompt');

    expect(loggerSpy).toHaveBeenCalledWith('Running LangChain agent with prompt: prompt');

    loggerSpy.mockRestore();
  });
});
