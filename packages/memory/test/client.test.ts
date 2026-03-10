import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyokuClient, KeyokuError } from '../src/client.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  };
}

describe('KeyokuClient', () => {
  let client: KeyokuClient;

  beforeEach(() => {
    client = new KeyokuClient({ baseUrl: 'http://localhost:18900' });
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('defaults to localhost:18900', () => {
      const c = new KeyokuClient({});
      mockFetch.mockResolvedValue(jsonResponse([]));
      c.listMemories('entity-1');

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('http://localhost:18900');
    });

    it('strips trailing slash', () => {
      const c = new KeyokuClient({ baseUrl: 'http://example.com/' });
      mockFetch.mockResolvedValue(jsonResponse([]));
      c.listMemories('e1');

      const url = mockFetch.mock.calls[0][0];
      expect(url.startsWith('http://example.com/api')).toBe(true);
    });
  });

  describe('remember', () => {
    it('calls POST /api/v1/remember with content', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        memories_created: 1,
        memories_updated: 0,
        memories_deleted: 0,
        skipped: 0,
      }));

      const result = await client.remember('entity-1', 'Important fact', {
        agent_id: 'agent-1',
        team_id: 'team-1',
      });

      expect(result.memories_created).toBe(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.entity_id).toBe('entity-1');
      expect(body.content).toBe('Important fact');
      expect(body.agent_id).toBe('agent-1');
    });
  });

  describe('search', () => {
    it('calls POST /api/v1/search', async () => {
      mockFetch.mockResolvedValue(jsonResponse([
        { memory: { id: 'm1', content: 'test' }, similarity: 0.9, score: 0.85 },
      ]));

      const results = await client.search('entity-1', 'test query', { limit: 5 });

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBe(0.9);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.query).toBe('test query');
      expect(body.limit).toBe(5);
    });
  });

  describe('listMemories', () => {
    it('calls GET with entity_id and limit', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));

      await client.listMemories('entity-1', 50);

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('entity_id=entity-1');
      expect(url).toContain('limit=50');
    });

    it('defaults limit to 100', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));
      await client.listMemories('entity-1');

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('limit=100');
    });
  });

  describe('getMemory', () => {
    it('calls GET /api/v1/memories/:id', async () => {
      const memory = { id: 'm1', content: 'test', entity_id: 'e1' };
      mockFetch.mockResolvedValue(jsonResponse(memory));

      const result = await client.getMemory('m1');
      expect(result.id).toBe('m1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:18900/api/v1/memories/m1',
        expect.anything(),
      );
    });
  });

  describe('deleteMemory', () => {
    it('calls DELETE /api/v1/memories/:id', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'deleted' }));

      const result = await client.deleteMemory('m1');
      expect(result.status).toBe('deleted');
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });
  });

  describe('deleteAllMemories', () => {
    it('calls DELETE with entity_id body', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'deleted' }));

      await client.deleteAllMemories('entity-1');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.entity_id).toBe('entity-1');
    });
  });

  describe('getStats', () => {
    it('calls GET /api/v1/stats/:entityId', async () => {
      const stats = { total_memories: 42, active_memories: 30, by_type: {}, by_state: {} };
      mockFetch.mockResolvedValue(jsonResponse(stats));

      const result = await client.getStats('entity-1');
      expect(result.total_memories).toBe(42);
    });
  });

  describe('heartbeatCheck', () => {
    it('calls POST /api/v1/heartbeat/check', async () => {
      mockFetch.mockResolvedValue(jsonResponse({
        should_act: false,
        pending_work: [],
        deadlines: [],
        scheduled: [],
        decaying: [],
        conflicts: [],
        stale_monitors: [],
        summary: 'All clear',
      }));

      const result = await client.heartbeatCheck('entity-1', {
        deadline_window: '1h',
        max_results: 10,
      });

      expect(result.should_act).toBe(false);
      expect(result.summary).toBe('All clear');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.entity_id).toBe('entity-1');
      expect(body.deadline_window).toBe('1h');
    });
  });

  describe('schedules', () => {
    it('createSchedule sends correct body', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 's1' }));

      await client.createSchedule('entity-1', 'agent-1', 'Daily standup', 'daily');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.entity_id).toBe('entity-1');
      expect(body.agent_id).toBe('agent-1');
      expect(body.content).toBe('Daily standup');
      expect(body.cron_tag).toBe('daily');
    });

    it('listSchedules filters by agent', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));

      await client.listSchedules('entity-1', 'agent-1');

      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('entity_id=entity-1');
      expect(url).toContain('agent_id=agent-1');
    });

    it('ackSchedule calls POST', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'acknowledged', memory_id: 'm1' }));

      const result = await client.ackSchedule('m1');
      expect(result.status).toBe('acknowledged');
    });

    it('cancelSchedule calls DELETE', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'cancelled', memory_id: 's1' }));

      const result = await client.cancelSchedule('s1');
      expect(result.status).toBe('cancelled');
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');
    });
  });

  describe('error handling', () => {
    it('throws KeyokuError on non-OK response', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Not found' }, 404));

      await expect(client.getMemory('bad-id')).rejects.toThrow(KeyokuError);
    });

    it('includes status and path in error', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ error: 'Server error' }, 500));

      try {
        await client.getStats('e1');
      } catch (err) {
        expect(err).toBeInstanceOf(KeyokuError);
        expect((err as KeyokuError).status).toBe(500);
        expect((err as KeyokuError).path).toContain('/api/v1/stats/e1');
      }
    });
  });
});
