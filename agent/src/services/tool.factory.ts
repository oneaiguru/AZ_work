import { Injectable } from '@nestjs/common';
import { DynamicTool, Tool } from 'langchain/tools';

@Injectable()
export class ToolFactory {
  createTools(context?: Record<string, unknown>): Tool[] {
    const tools: Tool[] = [
      new DynamicTool({
        name: 'time_now',
        description: 'Returns the current date and time in ISO 8601 format.',
        func: async () => new Date().toISOString(),
      }),
    ];

    if (context) {
      tools.push(
        new DynamicTool({
          name: 'context_lookup',
          description:
            'Look up values in the provided execution context. The input must be the exact key to retrieve.',
          func: async (input: string) => {
            const key = input.trim();
            if (!key) {
              return 'No key provided.';
            }
            if (!(key in context)) {
              return `Key "${key}" not found in context.`;
            }
            const value = context[key];
            if (typeof value === 'object') {
              return JSON.stringify(value);
            }
            return String(value);
          },
        }),
      );
    }

    return tools;
  }
}
