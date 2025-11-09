import { vi } from 'vitest';

class FakeTool {
  name: string;
  description: string;
  private readonly func: (input: string) => Promise<string> | string;

  constructor({
    name,
    description,
    func,
  }: {
    name: string;
    description: string;
    func: (input: string) => Promise<string> | string;
  }) {
    this.name = name;
    this.description = description;
    this.func = func;
  }

  async call(input: string) {
    return this.func(input);
  }
}

vi.mock('langchain/tools', () => ({
  DynamicTool: FakeTool,
  Tool: FakeTool,
}));

vi.mock('langchain/agents', () => ({
  initializeAgentExecutorWithOptions: vi.fn(),
  AgentExecutor: vi.fn(),
}));

vi.mock('langchain/chat_models/ollama', () => ({
  ChatOllama: vi.fn(),
}));
