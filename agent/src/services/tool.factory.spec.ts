import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolFactory } from './tool.factory';

describe('ToolFactory', () => {
  let factory: ToolFactory;

  beforeEach(() => {
    factory = new ToolFactory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a time tool that returns the current ISO timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-02-29T12:34:56.000Z'));

    const [timeTool] = factory.createTools();

    expect(timeTool.name).toBe('time_now');
    await expect(timeTool.call('')).resolves.toBe('2024-02-29T12:34:56.000Z');
  });

  it('includes a context lookup tool when context is provided', async () => {
    const tools = factory.createTools({
      greeting: 'hello',
      nested: { value: 42 },
    });

    const contextTool = tools.find((tool) => tool.name === 'context_lookup');
    expect(contextTool).toBeDefined();

    await expect(contextTool!.call('greeting')).resolves.toBe('hello');
    await expect(contextTool!.call('nested')).resolves.toBe('{"value":42}');
    await expect(contextTool!.call('missing')).resolves.toBe('Key "missing" not found in context.');
    await expect(contextTool!.call('   ')).resolves.toBe('No key provided.');
  });

  it('omits the context lookup tool when no context is provided', () => {
    const tools = factory.createTools();
    expect(tools.some((tool) => tool.name === 'context_lookup')).toBe(false);
  });
});
