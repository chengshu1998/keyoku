import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTools } from '../src/tools.js';
import type { PluginApi, AgentTool } from '../src/types.js';

// Mock KeyokuClient
function createMockClient() {
  return {
    search: vi.fn(),
    remember: vi.fn(),
    deleteMemory: vi.fn(),
    getStats: vi.fn(),
    createSchedule: vi.fn(),
    listSchedules: vi.fn(),
  };
}

function createMockApi() {
  const tools: Record<string, AgentTool> = {};
  return {
    api: {
      id: 'test',
      name: 'test',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      registerTool: vi.fn((tool: AgentTool, opts?: { name?: string }) => {
        tools[opts?.name ?? tool.name] = tool;
      }),
      registerHook: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn(),
      resolvePath: (p: string) => p,
      on: vi.fn(),
    } as unknown as PluginApi,
    tools,
  };
}

describe('tools', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    mockClient = createMockClient();
    mockApi = createMockApi();
    registerTools(mockApi.api, mockClient as any, 'entity-1', 'agent-1');
  });

  it('registers 6 tools', () => {
    expect(mockApi.api.registerTool).toHaveBeenCalledTimes(6);
  });

  describe('memory_recall', () => {
    it('searches and formats results', async () => {
      mockClient.search.mockResolvedValue([
        { memory: { content: 'Likes TypeScript' }, similarity: 0.92, score: 0.85 },
      ]);

      const tool = mockApi.tools['memory_recall'];
      const result = await tool.execute('call-1', { query: 'preferences' });

      expect(mockClient.search).toHaveBeenCalledWith('entity-1', 'preferences', { limit: 5 });
      expect(result.content[0].text).toContain('Likes TypeScript');
      expect(result.content[0].text).toContain('92%');
    });

    it('handles no results', async () => {
      mockClient.search.mockResolvedValue([]);

      const tool = mockApi.tools['memory_recall'];
      const result = await tool.execute('call-1', { query: 'nothing' });

      expect(result.content[0].text).toBe('No relevant memories found.');
    });

    it('respects limit parameter', async () => {
      mockClient.search.mockResolvedValue([]);

      const tool = mockApi.tools['memory_recall'];
      await tool.execute('call-1', { query: 'test', limit: 10 });

      expect(mockClient.search).toHaveBeenCalledWith('entity-1', 'test', { limit: 10 });
    });
  });

  describe('memory_store', () => {
    it('stores memory and returns confirmation', async () => {
      mockClient.remember.mockResolvedValue({ memories_created: 1 });

      const tool = mockApi.tools['memory_store'];
      const result = await tool.execute('call-1', { text: 'User prefers dark mode' });

      expect(mockClient.remember).toHaveBeenCalledWith(
        'entity-1',
        'User prefers dark mode',
        { agent_id: 'agent-1' },
      );
      expect(result.content[0].text).toContain('Stored');
      expect(result.content[0].text).toContain('dark mode');
    });
  });

  describe('memory_forget', () => {
    it('deletes memory by ID', async () => {
      mockClient.deleteMemory.mockResolvedValue({ status: 'deleted' });

      const tool = mockApi.tools['memory_forget'];
      const result = await tool.execute('call-1', { memory_id: 'm1' });

      expect(mockClient.deleteMemory).toHaveBeenCalledWith('m1');
      expect(result.content[0].text).toContain('deleted');
    });
  });

  describe('memory_stats', () => {
    it('returns formatted stats', async () => {
      mockClient.getStats.mockResolvedValue({
        total_memories: 42,
        active_memories: 30,
        by_type: { fact: 20, preference: 10 },
        by_state: { active: 30, archived: 12 },
      });

      const tool = mockApi.tools['memory_stats'];
      const result = await tool.execute('call-1', {});

      expect(result.content[0].text).toContain('Total memories: 42');
      expect(result.content[0].text).toContain('Active memories: 30');
    });
  });

  describe('schedule_create', () => {
    it('creates schedule with correct params', async () => {
      mockClient.createSchedule.mockResolvedValue({ id: 's1' });

      const tool = mockApi.tools['schedule_create'];
      const result = await tool.execute('call-1', {
        content: 'Daily standup',
        cron_tag: 'daily',
      });

      expect(mockClient.createSchedule).toHaveBeenCalledWith(
        'entity-1', 'agent-1', 'Daily standup', 'daily',
      );
      expect(result.content[0].text).toContain('Scheduled');
    });
  });

  describe('schedule_list', () => {
    it('lists schedules', async () => {
      mockClient.listSchedules.mockResolvedValue([
        { id: 's1', content: 'Daily standup' },
        { id: 's2', content: 'Weekly review' },
      ]);

      const tool = mockApi.tools['schedule_list'];
      const result = await tool.execute('call-1', {});

      expect(result.content[0].text).toContain('2 schedules');
      expect(result.content[0].text).toContain('Daily standup');
      expect(result.content[0].text).toContain('Weekly review');
    });

    it('handles no schedules', async () => {
      mockClient.listSchedules.mockResolvedValue([]);

      const tool = mockApi.tools['schedule_list'];
      const result = await tool.execute('call-1', {});

      expect(result.content[0].text).toBe('No active schedules.');
    });
  });
});
