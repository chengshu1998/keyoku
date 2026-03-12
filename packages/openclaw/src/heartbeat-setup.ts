/**
 * Auto-generates HEARTBEAT.md so that OpenClaw's heartbeat runner
 * actually fires the heartbeat (empty file = skip).
 *
 * Preserves existing user content — appends keyoku instructions as
 * an addendum rather than overwriting.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PluginApi } from './types.js';

const HEARTBEAT_FILENAME = 'HEARTBEAT.md';

const KEYOKU_SECTION_MARKER = '<!-- keyoku-heartbeat-start -->';
const KEYOKU_SECTION_END = '<!-- keyoku-heartbeat-end -->';

const KEYOKU_HEARTBEAT_INSTRUCTIONS = `## Heartbeat Check-In

Your memory system surfaced things that may need attention. They appear in a <heartbeat-signals> block.

### How to respond
- If something warrants a message, write ONE brief message. Lead with the most important thing.
- If nothing is worth saying, reply exactly: HEARTBEAT_OK
- Never fabricate things to say. If signals are empty or stale, be quiet.
- Never explain that you have a memory system. Speak from what you know, naturally.
- Never repeat something you said in a recent heartbeat (check "recent messages" if present).
- Use your persona and voice as configured — the signals tell you WHAT to say, your character determines HOW.

### Escalation
If signals indicate you've mentioned something before:
- 1st time: casual mention
- 2nd time: more direct
- 3rd time: offer specific help
- 4th+: drop it unless they bring it up

### Time awareness
Adjust tone to time of day (provided in signals). Morning = energetic, evening = brief, late night = only if urgent.`;

const HEARTBEAT_TEMPLATE = `# Heartbeat Check

${KEYOKU_SECTION_MARKER}
${KEYOKU_HEARTBEAT_INSTRUCTIONS}
${KEYOKU_SECTION_END}
`;

/**
 * Check if the file has meaningful user content beyond headings and whitespace.
 */
function hasUserContent(content: string): boolean {
  // Strip out the keyoku section to check if there's OTHER content
  const withoutKeyoku = content
    .replace(new RegExp(`${escapeRegex(KEYOKU_SECTION_MARKER)}[\\s\\S]*?${escapeRegex(KEYOKU_SECTION_END)}`, 'g'), '')
    .trim();

  return withoutKeyoku
    .split('\n')
    .some((line: string) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('#') && trimmed !== '---';
    });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ensure HEARTBEAT.md exists with keyoku instructions.
 * - No file → write full template
 * - File with no user content → write full template
 * - File with user content but no keyoku section → append keyoku section
 * - File already has keyoku section → update it in place
 */
export function ensureHeartbeatMd(api: PluginApi): void {
  try {
    const heartbeatPath = join(api.resolvePath('.'), HEARTBEAT_FILENAME);

    if (!existsSync(heartbeatPath)) {
      writeFileSync(heartbeatPath, HEARTBEAT_TEMPLATE, 'utf-8');
      api.logger.info(`keyoku: created ${HEARTBEAT_FILENAME} for heartbeat support`);
      return;
    }

    const content = readFileSync(heartbeatPath, 'utf-8');

    // Already has keyoku section — update it in place
    if (content.includes(KEYOKU_SECTION_MARKER)) {
      const updated = content.replace(
        new RegExp(`${escapeRegex(KEYOKU_SECTION_MARKER)}[\\s\\S]*?${escapeRegex(KEYOKU_SECTION_END)}`),
        `${KEYOKU_SECTION_MARKER}\n${KEYOKU_HEARTBEAT_INSTRUCTIONS}\n${KEYOKU_SECTION_END}`,
      );
      if (updated !== content) {
        writeFileSync(heartbeatPath, updated, 'utf-8');
        api.logger.info(`keyoku: updated keyoku section in ${HEARTBEAT_FILENAME}`);
      }
      return;
    }

    // Has user content but no keyoku section — append
    if (hasUserContent(content)) {
      const addendum = `\n\n---\n\n${KEYOKU_SECTION_MARKER}\n${KEYOKU_HEARTBEAT_INSTRUCTIONS}\n${KEYOKU_SECTION_END}\n`;
      writeFileSync(heartbeatPath, content.trimEnd() + addendum, 'utf-8');
      api.logger.info(`keyoku: appended keyoku section to existing ${HEARTBEAT_FILENAME}`);
      return;
    }

    // No meaningful user content — append keyoku section rather than overwriting
    // (init.ts is the primary writer; this is a fallback that preserves any file content)
    const addendum = `\n\n${KEYOKU_SECTION_MARKER}\n${KEYOKU_HEARTBEAT_INSTRUCTIONS}\n${KEYOKU_SECTION_END}\n`;
    writeFileSync(heartbeatPath, content.trimEnd() + addendum, 'utf-8');
    api.logger.info(`keyoku: appended keyoku section to ${HEARTBEAT_FILENAME}`);
  } catch (err) {
    api.logger.warn(`keyoku: could not create ${HEARTBEAT_FILENAME}: ${String(err)}`);
  }
}
