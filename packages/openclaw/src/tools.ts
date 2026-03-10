/**
 * OpenClaw tool registrations for Keyoku memory operations.
 * Registers 6 tools: memory_recall, memory_store, memory_forget, memory_stats,
 * schedule_create, schedule_list
 */

import { Type } from '@sinclair/typebox';
import type { KeyokuClient } from '@keyoku/memory';
import type { PluginApi } from './types.js';

export function registerTools(api: PluginApi, client: KeyokuClient, entityId: string, agentId: string): void {
  // memory_recall — search memories by query
  api.registerTool(
    {
      name: 'memory_recall',
      label: 'Memory Recall',
      description:
        'Search through long-term memories. Use when you need context about user preferences, past decisions, or previously discussed topics.',
      parameters: Type.Object({
        query: Type.String({ description: 'Search query' }),
        limit: Type.Optional(Type.Number({ description: 'Max results (default: 5)' })),
      }),
      async execute(_toolCallId, params) {
        const { query, limit = 5 } = params as { query: string; limit?: number };
        const results = await client.search(entityId, query, { limit });

        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: 'No relevant memories found.' }],
            details: { count: 0 },
          };
        }

        const text = results
          .map((r, i) => `${i + 1}. [${(r.similarity * 100).toFixed(0)}%] ${r.memory.content}`)
          .join('\n');

        return {
          content: [{ type: 'text', text: `Found ${results.length} memories:\n\n${text}` }],
          details: { count: results.length },
        };
      },
    },
    { name: 'memory_recall' },
  );

  // memory_store — store a new memory
  api.registerTool(
    {
      name: 'memory_store',
      label: 'Memory Store',
      description:
        'Save important information in long-term memory. Use for preferences, facts, decisions.',
      parameters: Type.Object({
        text: Type.String({ description: 'Information to remember' }),
      }),
      async execute(_toolCallId, params) {
        const { text } = params as { text: string };
        const result = await client.remember(entityId, text, { agent_id: agentId });

        return {
          content: [{ type: 'text', text: `Stored: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"` }],
          details: { memories_created: result.memories_created },
        };
      },
    },
    { name: 'memory_store' },
  );

  // memory_forget — delete a memory by ID
  api.registerTool(
    {
      name: 'memory_forget',
      label: 'Memory Forget',
      description: 'Delete a specific memory by ID.',
      parameters: Type.Object({
        memory_id: Type.String({ description: 'The memory ID to delete' }),
      }),
      async execute(_toolCallId, params) {
        const { memory_id } = params as { memory_id: string };
        const result = await client.deleteMemory(memory_id);

        return {
          content: [{ type: 'text', text: `Memory ${memory_id} deleted.` }],
          details: { status: result.status },
        };
      },
    },
    { name: 'memory_forget' },
  );

  // memory_stats — get memory statistics
  api.registerTool(
    {
      name: 'memory_stats',
      label: 'Memory Stats',
      description: 'Get memory statistics for the current entity.',
      parameters: Type.Object({}),
      async execute() {
        const stats = await client.getStats(entityId);

        const text = [
          `Total memories: ${stats.total_memories}`,
          `Active memories: ${stats.active_memories}`,
          `By type: ${JSON.stringify(stats.by_type)}`,
          `By state: ${JSON.stringify(stats.by_state)}`,
        ].join('\n');

        return {
          content: [{ type: 'text', text }],
          details: { ...stats } as Record<string, unknown>,
        };
      },
    },
    { name: 'memory_stats' },
  );

  // schedule_create — create a scheduled memory
  api.registerTool(
    {
      name: 'schedule_create',
      label: 'Schedule Create',
      description:
        'Create a scheduled task/reminder. Cron tags: "daily", "weekly", "monthly", or a cron expression.',
      parameters: Type.Object({
        content: Type.String({ description: 'What to schedule' }),
        cron_tag: Type.String({ description: 'Cron tag: "daily", "weekly", "monthly", or cron expression' }),
      }),
      async execute(_toolCallId, params) {
        const { content, cron_tag } = params as { content: string; cron_tag: string };
        const result = await client.createSchedule(entityId, agentId, content, cron_tag);

        return {
          content: [{ type: 'text', text: `Scheduled: "${content}" (${cron_tag})` }],
          details: { id: result.id },
        };
      },
    },
    { name: 'schedule_create' },
  );

  // schedule_list — list schedules
  api.registerTool(
    {
      name: 'schedule_list',
      label: 'Schedule List',
      description: 'List active schedules.',
      parameters: Type.Object({}),
      async execute() {
        const schedules = await client.listSchedules(entityId, agentId);

        if (schedules.length === 0) {
          return {
            content: [{ type: 'text', text: 'No active schedules.' }],
            details: { count: 0 },
          };
        }

        const text = schedules
          .map((s, i) => `${i + 1}. ${s.content} (id: ${s.id})`)
          .join('\n');

        return {
          content: [{ type: 'text', text: `${schedules.length} schedules:\n\n${text}` }],
          details: { count: schedules.length },
        };
      },
    },
    { name: 'schedule_list' },
  );
}
