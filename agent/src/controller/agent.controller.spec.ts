import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller';
import { AgentService } from '../services/agent.service';
import { HttpException } from '@nestjs/common';

describe('AgentController', () => {
  let controller: AgentController;
  let agentService: { run: jest.Mock };

  beforeEach(async () => {
    agentService = { run: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [{ provide: AgentService, useValue: agentService }],
    }).compile();

    controller = module.get<AgentController>(AgentController);
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
