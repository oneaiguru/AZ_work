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

jest.mock('langchain/tools', () => ({
  __esModule: true,
  DynamicTool: FakeTool,
  Tool: FakeTool,
}));

jest.mock('langchain/agents', () => ({
  initializeAgentExecutorWithOptions: jest.fn(),
  AgentExecutor: jest.fn(),
}));

jest.mock('langchain/chat_models/ollama', () => ({
  ChatOllama: jest.fn(),
}));
