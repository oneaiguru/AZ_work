import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { RunAgentDto } from './run-agent.dto';

describe('RunAgentDto', () => {
  it('accepts a prompt and optional context', async () => {
    const dto = new RunAgentDto();
    dto.prompt = 'hello';
    dto.context = { foo: 'bar' };

    const result = await validate(dto);

    expect(result).toHaveLength(0);
  });

  it('requires a non-empty prompt', async () => {
    const dto = new RunAgentDto();
    dto.prompt = '';

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'prompt')).toBe(true);
  });
});
