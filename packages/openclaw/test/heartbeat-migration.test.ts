import { describe, it, expect, vi } from 'vitest';
import { extractHeartbeatRules, parseTimeToCron, migrateHeartbeatRules } from '../src/heartbeat-migration.js';

describe('parseTimeToCron', () => {
  it('parses "at 9am" to cron:daily:09:00', () => {
    expect(parseTimeToCron('Remind me at 9am')).toBe('cron:daily:09:00');
  });

  it('parses "at 2pm" to cron:daily:14:00', () => {
    expect(parseTimeToCron('Check in at 2pm')).toBe('cron:daily:14:00');
  });

  it('parses "at 9:30am" to cron:daily:09:30', () => {
    expect(parseTimeToCron('standup at 9:30am')).toBe('cron:daily:09:30');
  });

  it('parses "at 12pm" (noon) correctly', () => {
    expect(parseTimeToCron('lunch at 12pm')).toBe('cron:daily:12:00');
  });

  it('parses "at 12am" (midnight) correctly', () => {
    expect(parseTimeToCron('reset at 12am')).toBe('cron:daily:00:00');
  });

  it('parses "at 14:30" (24h format)', () => {
    expect(parseTimeToCron('meeting at 14:30')).toBe('cron:daily:14:30');
  });

  it('parses "every 2 hours"', () => {
    expect(parseTimeToCron('Check PRs every 2 hours')).toBe('cron:every:2h');
  });

  it('parses "every 30 minutes"', () => {
    expect(parseTimeToCron('poll every 30 minutes')).toBe('cron:every:30m');
  });

  it('parses "every hour"', () => {
    expect(parseTimeToCron('check every hour')).toBe('cron:hourly');
  });

  it('parses "hourly"', () => {
    expect(parseTimeToCron('run hourly health check')).toBe('cron:hourly');
  });

  it('parses "every morning"', () => {
    expect(parseTimeToCron('greet every morning')).toBe('cron:daily:08:00');
  });

  it('parses "every evening"', () => {
    expect(parseTimeToCron('summary every evening')).toBe('cron:daily:18:00');
  });

  it('parses "daily"', () => {
    expect(parseTimeToCron('run daily backup')).toBe('cron:daily');
  });

  it('parses "every day"', () => {
    expect(parseTimeToCron('check every day')).toBe('cron:daily');
  });

  it('parses "weekly"', () => {
    expect(parseTimeToCron('weekly review')).toBe('cron:weekly');
  });

  it('parses "monthly"', () => {
    expect(parseTimeToCron('monthly report')).toBe('cron:monthly');
  });

  it('returns null for no time pattern', () => {
    expect(parseTimeToCron('I like dark mode')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseTimeToCron('')).toBeNull();
  });
});

describe('extractHeartbeatRules', () => {
  it('extracts list items as rules', () => {
    const content = `# My Rules\n- I prefer morning check-ins\n- Keep messages short`;
    const rules = extractHeartbeatRules(content);
    expect(rules).toHaveLength(2);
    expect(rules[0].content).toBe('I prefer morning check-ins');
    expect(rules[1].content).toBe('Keep messages short');
  });

  it('ignores keyoku section content', () => {
    const content = `# Rules\n- My real rule\n<!-- keyoku-heartbeat-start -->\n- This is keyoku instruction\n<!-- keyoku-heartbeat-end -->\n- Another real rule`;
    const rules = extractHeartbeatRules(content);
    expect(rules).toHaveLength(2);
    expect(rules[0].content).toBe('My real rule');
    expect(rules[1].content).toBe('Another real rule');
  });

  it('classifies time patterns as schedule', () => {
    const content = `- Remind me about standup at 9am\n- Check PRs every 2 hours`;
    const rules = extractHeartbeatRules(content);
    expect(rules).toHaveLength(2);
    expect(rules[0].type).toBe('schedule');
    expect(rules[0].cronTag).toBe('cron:daily:09:00');
    expect(rules[1].type).toBe('schedule');
    expect(rules[1].cronTag).toBe('cron:every:2h');
  });

  it('classifies constraint patterns as rule', () => {
    const content = `- Never message me between 11pm-7am\n- Always be concise\n- Don't repeat yourself`;
    const rules = extractHeartbeatRules(content);
    expect(rules).toHaveLength(3);
    expect(rules[0].type).toBe('rule');
    expect(rules[1].type).toBe('rule');
    expect(rules[2].type).toBe('rule');
  });

  it('classifies other items as preference', () => {
    const content = `- I like dark mode\n- Keep it casual`;
    const rules = extractHeartbeatRules(content);
    expect(rules).toHaveLength(2);
    expect(rules[0].type).toBe('preference');
    expect(rules[1].type).toBe('preference');
  });

  it('handles empty content', () => {
    expect(extractHeartbeatRules('')).toHaveLength(0);
    expect(extractHeartbeatRules('  ')).toHaveLength(0);
  });

  it('handles content with no list items', () => {
    const content = `# Heartbeat\n\nSome paragraph text without list items.`;
    expect(extractHeartbeatRules(content)).toHaveLength(0);
  });

  it('skips very short list items', () => {
    const content = `- Hi\n- This is a real rule about something`;
    const rules = extractHeartbeatRules(content);
    expect(rules).toHaveLength(1);
    expect(rules[0].content).toBe('This is a real rule about something');
  });

  it('handles * list markers', () => {
    const content = `* Star-prefixed rule here`;
    const rules = extractHeartbeatRules(content);
    expect(rules).toHaveLength(1);
    expect(rules[0].content).toBe('Star-prefixed rule here');
  });
});

describe('migrateHeartbeatRules', () => {
  function createMockClient() {
    return {
      remember: vi.fn().mockResolvedValue({ memories_created: 1 }),
      createSchedule: vi.fn().mockResolvedValue({ id: 'sched-1' }),
    };
  }

  it('calls client.remember for preferences', async () => {
    const client = createMockClient();
    const rules = [{ raw: '- I like dark mode', type: 'preference' as const, content: 'I like dark mode' }];
    const result = await migrateHeartbeatRules({
      client: client as any,
      entityId: 'test',
      agentId: 'agent-1',
      rules,
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    expect(client.remember).toHaveBeenCalledWith('test', '[User heartbeat preference] I like dark mode', {
      agent_id: 'agent-1',
      source: 'migration:heartbeat',
    });
    expect(result.preferences).toBe(1);
  });

  it('calls client.remember for rules', async () => {
    const client = createMockClient();
    const rules = [{ raw: '- Never spam', type: 'rule' as const, content: 'Never spam me' }];
    const result = await migrateHeartbeatRules({
      client: client as any,
      entityId: 'test',
      agentId: 'agent-1',
      rules,
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    expect(client.remember).toHaveBeenCalledWith('test', '[User heartbeat rule] Never spam me', {
      agent_id: 'agent-1',
      source: 'migration:heartbeat',
    });
    expect(result.rules).toBe(1);
  });

  it('calls client.createSchedule for schedule rules', async () => {
    const client = createMockClient();
    const rules = [{ raw: '- Check PRs every 2 hours', type: 'schedule' as const, content: 'Check PRs every 2 hours', cronTag: 'cron:every:2h' }];
    const result = await migrateHeartbeatRules({
      client: client as any,
      entityId: 'test',
      agentId: 'agent-1',
      rules,
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    expect(client.createSchedule).toHaveBeenCalledWith('test', 'agent-1', 'Check PRs every 2 hours', 'cron:every:2h');
    expect(result.schedules).toBe(1);
  });

  it('handles API errors gracefully', async () => {
    const client = createMockClient();
    client.remember.mockRejectedValue(new Error('Network error'));
    const rules = [{ raw: '- Pref', type: 'preference' as const, content: 'Some preference here' }];
    const logger = { info: vi.fn(), warn: vi.fn() };
    const result = await migrateHeartbeatRules({
      client: client as any,
      entityId: 'test',
      agentId: 'agent-1',
      rules,
      logger,
    });

    expect(result.errors).toBe(1);
    expect(result.preferences).toBe(0);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('returns correct counts for mixed rules', async () => {
    const client = createMockClient();
    const rules = [
      { raw: '', type: 'preference' as const, content: 'I like TypeScript' },
      { raw: '', type: 'rule' as const, content: 'Never be verbose' },
      { raw: '', type: 'schedule' as const, content: 'Check daily', cronTag: 'cron:daily' },
      { raw: '', type: 'preference' as const, content: 'Keep it brief' },
    ];
    const result = await migrateHeartbeatRules({
      client: client as any,
      entityId: 'test',
      agentId: 'agent-1',
      rules,
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    expect(result.preferences).toBe(2);
    expect(result.rules).toBe(1);
    expect(result.schedules).toBe(1);
    expect(result.errors).toBe(0);
  });
});
