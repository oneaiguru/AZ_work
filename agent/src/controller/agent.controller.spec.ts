import { HttpException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AgentController } from './agent.controller';
import { AgentService } from '../services/agent.service';

describe('AgentController', () => {
  let controller: AgentController;
  let agentService: { run: Mock };

  beforeEach(() => {
    agentService = { run: vi.fn() };
    controller = new AgentController(agentService as unknown as AgentService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the agent service result', async () => {
    agentService.run.mockResolvedValue({ output: 'response', intermediateSteps: [] });

    const result = await controller.runAgent({ prompt: 'hi', context: { foo: 'bar' } });

    expect(agentService.run).toHaveBeenCalledWith('hi', { foo: 'bar' });
    expect(result).toEqual({ result: { output: 'response', intermediateSteps: [] } });
  });

  it('wraps service errors into an HttpException', async () => {
    agentService.run.mockRejectedValue(new Error('boom'));

    await expect(controller.runAgent({ prompt: 'hello' })).rejects.toBeInstanceOf(HttpException);

    try {
      await controller.runAgent({ prompt: 'hello' });
    } catch (error) {
      const httpError = error as HttpException;
      expect(httpError.getStatus()).toBe(500);
      expect(httpError.getResponse()).toEqual({
        message: 'Agent execution failed',
        error: 'boom',
      });
    }
  });
});
