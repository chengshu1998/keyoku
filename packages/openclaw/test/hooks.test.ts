import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerHooks } from '../src/hooks.js';
import { resolveConfig } from '../src/config.js';
import type { PluginApi } from '../src/types.js';

function createMockClient() {
  return {
    search: vi.fn(),
    remember: vi.fn(),
    heartbeatCheck: vi.fn(),
  };
}

function createMockApi() {
  const hooks: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    api: {
      id: 'test',
      name: 'test',
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      registerTool: vi.fn(),
      registerHook: vi.fn(),
      registerCli: vi.fn(),
      registerService: vi.fn(),
      resolvePath: (p: string) => p,
      on: vi.fn((hookName: string, handler: (...args: unknown[]) => unknown) => {
        hooks[hookName] = handler;
      }),
    } as unknown as PluginApi,
    hooks,
  };
}

describe('hooks', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let mockApi: ReturnType<typeof createMockApi>;

  describe('before_prompt_build (auto-recall)', () => {
    beforeEach(() => {
      mockClient = createMockClient();
      mockApi = createMockApi();
      registerHooks(mockApi.api, mockClient as any, 'entity-1', 'agent-1', resolveConfig({ autoRecall: true, heartbeat: false, autoCapture: false }));
    });

    it('registers before_prompt_build hook', () => {
      expect(mockApi.hooks['before_prompt_build']).toBeDefined();
    });

    it('injects memory context when results found', async () => {
      mockClient.search.mockResolvedValue([
        { memory: { content: 'User likes TypeScript' }, similarity: 0.9, score: 0.8 },
      ]);

      const result = await mockApi.hooks['before_prompt_build']({ prompt: 'What do I prefer?' });

      expect(mockClient.search).toHaveBeenCalledWith('entity-1', 'What do I prefer?', { limit: 5, min_score: 0.1 });
      expect(result).toHaveProperty('prependContext');
      expect((result as { prependContext: string }).prependContext).toContain('User likes TypeScript');
    });

    it('returns undefined when no results', async () => {
      mockClient.search.mockResolvedValue([]);

      const result = await mockApi.hooks['before_prompt_build']({ prompt: 'Hello there' });
      expect(result).toBeUndefined();
    });

    it('skips short prompts', async () => {
      const result = await mockApi.hooks['before_prompt_build']({ prompt: 'Hi' });
      expect(mockClient.search).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('handles search errors gracefully', async () => {
      mockClient.search.mockRejectedValue(new Error('Network error'));

      const result = await mockApi.hooks['before_prompt_build']({ prompt: 'What do I prefer?' });
      expect(result).toBeUndefined();
      expect(mockApi.api.logger.warn).toHaveBeenCalled();
    });
  });

  describe('before_prompt_build (heartbeat)', () => {
    beforeEach(() => {
      mockClient = createMockClient();
      mockApi = createMockApi();
      registerHooks(mockApi.api, mockClient as any, 'entity-1', 'agent-1', resolveConfig({ autoRecall: false, heartbeat: true, autoCapture: false }));
    });

    it('injects heartbeat data when HEARTBEAT is in prompt', async () => {
      mockClient.heartbeatCheck.mockResolvedValue({
        should_act: true,
        pending_work: [],
        deadlines: [{ content: 'Report due', expires_at: '2024-03-15', importance: 0.9 }],
        scheduled: [],
        decaying: [],
        conflicts: [],
        stale_monitors: [],
        summary: 'Deadline approaching',
      });

      const result = await mockApi.hooks['before_prompt_build']({
        prompt: 'Read HEARTBEAT.md and follow instructions',
      });

      expect(mockClient.heartbeatCheck).toHaveBeenCalledWith('entity-1', {
        agent_id: 'agent-1',
        max_results: 10,
      });
      expect(result).toHaveProperty('prependContext');
      expect((result as { prependContext: string }).prependContext).toContain('Report due');
    });

    it('does not inject heartbeat data for normal prompts', async () => {
      const result = await mockApi.hooks['before_prompt_build']({
        prompt: 'Tell me about the weather',
      });

      expect(mockClient.heartbeatCheck).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('agent_end (auto-capture)', () => {
    beforeEach(() => {
      mockClient = createMockClient();
      mockApi = createMockApi();
      registerHooks(mockApi.api, mockClient as any, 'entity-1', 'agent-1', resolveConfig({ autoRecall: false, heartbeat: false, autoCapture: true }));
    });

    it('registers agent_end hook', () => {
      expect(mockApi.hooks['agent_end']).toBeDefined();
    });

    it('captures memorable user messages', async () => {
      mockClient.remember.mockResolvedValue({ memories_created: 1 });

      await mockApi.hooks['agent_end']({
        success: true,
        messages: [
          { role: 'user', content: 'I prefer TypeScript over JavaScript always' },
          { role: 'assistant', content: 'Noted!' },
        ],
      });

      expect(mockClient.remember).toHaveBeenCalledWith(
        'entity-1',
        'I prefer TypeScript over JavaScript always',
        { agent_id: 'agent-1', source: 'auto-capture' },
      );
    });

    it('skips when success is false', async () => {
      await mockApi.hooks['agent_end']({
        success: false,
        messages: [{ role: 'user', content: 'I prefer TypeScript' }],
      });

      expect(mockClient.remember).not.toHaveBeenCalled();
    });

    it('skips when no messages', async () => {
      await mockApi.hooks['agent_end']({ success: true, messages: [] });
      expect(mockClient.remember).not.toHaveBeenCalled();
    });

    it('limits captures to 3 per conversation', async () => {
      mockClient.remember.mockResolvedValue({ memories_created: 1 });

      await mockApi.hooks['agent_end']({
        success: true,
        messages: [
          { role: 'user', content: 'I prefer dark mode always' },
          { role: 'user', content: 'I love TypeScript always' },
          { role: 'user', content: 'I need vim keybindings always' },
          { role: 'user', content: 'I want fast builds always' },
          { role: 'user', content: 'I like Rust too always' },
        ],
      });

      expect(mockClient.remember).toHaveBeenCalledTimes(3);
    });
  });

  describe('disabled hooks', () => {
    it('does not register hooks when all disabled', () => {
      mockClient = createMockClient();
      mockApi = createMockApi();
      registerHooks(mockApi.api, mockClient as any, 'entity-1', 'agent-1', resolveConfig({
        autoRecall: false,
        heartbeat: false,
        autoCapture: false,
      }));

      expect(mockApi.api.on).not.toHaveBeenCalled();
    });
  });
});
