/**
 * Heartbeat content migration.
 *
 * Extracts user rules from an existing HEARTBEAT.md and ingests them
 * into Keyoku as memories (preferences/rules) and scheduled tasks.
 *
 * The parsing functions are pure (no side effects) for testability.
 */

import type { KeyokuClient } from '@keyoku/memory';

export interface HeartbeatRule {
  raw: string;
  type: 'preference' | 'rule' | 'schedule';
  content: string;
  cronTag?: string;
}

export interface HeartbeatMigrationResult {
  rules: number;
  preferences: number;
  schedules: number;
  errors: number;
}

const KEYOKU_SECTION_START = '<!-- keyoku-heartbeat-start -->';
const KEYOKU_SECTION_END = '<!-- keyoku-heartbeat-end -->';

// Time patterns → cron tag mappings
const TIME_PATTERNS: Array<{ pattern: RegExp; toCron: (match: RegExpMatchArray) => string }> = [
  // "at 9am", "at 2pm", "at 9:30am"
  {
    pattern: /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
    toCron: (m) => {
      let hour = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      if (m[3].toLowerCase() === 'pm' && hour !== 12) hour += 12;
      if (m[3].toLowerCase() === 'am' && hour === 12) hour = 0;
      return `cron:daily:${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    },
  },
  // "at 09:00", "at 14:30"
  {
    pattern: /\bat\s+(\d{1,2}):(\d{2})\b/,
    toCron: (m) => `cron:daily:${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}`,
  },
  // "every N hours"
  {
    pattern: /\bevery\s+(\d+)\s*hours?\b/i,
    toCron: (m) => `cron:every:${m[1]}h`,
  },
  // "every N minutes"
  {
    pattern: /\bevery\s+(\d+)\s*min(?:ute)?s?\b/i,
    toCron: (m) => `cron:every:${m[1]}m`,
  },
  // "every hour" / "hourly"
  {
    pattern: /\b(?:every\s+hour|hourly)\b/i,
    toCron: () => 'cron:hourly',
  },
  // "every morning"
  {
    pattern: /\bevery\s+morning\b/i,
    toCron: () => 'cron:daily:08:00',
  },
  // "every evening"
  {
    pattern: /\bevery\s+evening\b/i,
    toCron: () => 'cron:daily:18:00',
  },
  // "every night"
  {
    pattern: /\bevery\s+night\b/i,
    toCron: () => 'cron:daily:21:00',
  },
  // "daily" / "every day"
  {
    pattern: /\b(?:daily|every\s+day)\b/i,
    toCron: () => 'cron:daily',
  },
  // "weekly" / "every week"
  {
    pattern: /\b(?:weekly|every\s+week)\b/i,
    toCron: () => 'cron:weekly',
  },
  // "monthly" / "every month"
  {
    pattern: /\b(?:monthly|every\s+month)\b/i,
    toCron: () => 'cron:monthly',
  },
];

// Constraint/rule patterns
const RULE_PATTERNS = [
  /\bnever\b/i,
  /\balways\b/i,
  /\bdon'?t\b/i,
  /\bdo\s+not\b/i,
  /\bmust\s+not\b/i,
  /\bshould\s+not\b/i,
  /\bavoid\b/i,
  /\bonly\s+(?:if|when)\b/i,
];

/**
 * Parse a natural-language time expression into a keyoku cron tag.
 * Returns null if no recognizable time pattern is found.
 */
export function parseTimeToCron(text: string): string | null {
  for (const { pattern, toCron } of TIME_PATTERNS) {
    const match = text.match(pattern);
    if (match) return toCron(match);
  }
  return null;
}

/**
 * Extract user rules from HEARTBEAT.md content.
 * Strips the keyoku section (instructions, not user rules) and
 * extracts list items (- ...) from the remaining content.
 */
export function extractHeartbeatRules(content: string): HeartbeatRule[] {
  if (!content || !content.trim()) return [];

  // Strip keyoku section
  let cleaned = content;
  const startIdx = cleaned.indexOf(KEYOKU_SECTION_START);
  const endIdx = cleaned.indexOf(KEYOKU_SECTION_END);
  if (startIdx !== -1 && endIdx !== -1) {
    cleaned = cleaned.slice(0, startIdx) + cleaned.slice(endIdx + KEYOKU_SECTION_END.length);
  }

  // Extract list items (lines starting with - or *)
  const lines = cleaned.split('\n');
  const rules: HeartbeatRule[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match list items: "- something" or "* something"
    const match = trimmed.match(/^[-*]\s+(.+)/);
    if (!match) continue;

    const text = match[1].trim();
    if (text.length < 5) continue;

    const cronTag = parseTimeToCron(text);

    if (cronTag) {
      rules.push({ raw: trimmed, type: 'schedule', content: text, cronTag });
    } else if (RULE_PATTERNS.some((p) => p.test(text))) {
      rules.push({ raw: trimmed, type: 'rule', content: text });
    } else {
      rules.push({ raw: trimmed, type: 'preference', content: text });
    }
  }

  return rules;
}

/**
 * Migrate extracted heartbeat rules into Keyoku.
 * Preferences/rules → client.remember(), schedules → client.createSchedule().
 */
export async function migrateHeartbeatRules(params: {
  client: KeyokuClient;
  entityId: string;
  agentId: string;
  rules: HeartbeatRule[];
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
}): Promise<HeartbeatMigrationResult> {
  const { client, entityId, agentId, rules, logger = console } = params;
  const result: HeartbeatMigrationResult = { rules: 0, preferences: 0, schedules: 0, errors: 0 };

  for (const rule of rules) {
    try {
      if (rule.type === 'schedule' && rule.cronTag) {
        await client.createSchedule(entityId, agentId, rule.content, rule.cronTag);
        result.schedules++;
        logger.info(`Migrated schedule: ${rule.content.slice(0, 60)}`);
      } else {
        const prefix = rule.type === 'rule' ? '[User heartbeat rule]' : '[User heartbeat preference]';
        await client.remember(entityId, `${prefix} ${rule.content}`, {
          agent_id: agentId,
          source: 'migration:heartbeat',
        });
        if (rule.type === 'rule') {
          result.rules++;
        } else {
          result.preferences++;
        }
        logger.info(`Migrated ${rule.type}: ${rule.content.slice(0, 60)}`);
      }
    } catch (err) {
      logger.warn(`Failed to migrate heartbeat rule: ${String(err)}`);
      result.errors++;
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  return result;
}
