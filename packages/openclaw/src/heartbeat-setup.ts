/**
 * Auto-generates HEARTBEAT.md so that OpenClaw's heartbeat runner
 * actually fires the heartbeat (empty file = skip).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PluginApi } from './types.js';

const HEARTBEAT_FILENAME = 'HEARTBEAT.md';

const HEARTBEAT_TEMPLATE = `# Heartbeat Check

You have been checked in on. Your memory system has reviewed your recent activity and surfaced anything that needs your attention. The signals are injected into your context automatically — look for the <heartbeat-signals> block.

## How to respond

IMPORTANT: If the signals contain \`should_act: true\` or a "Tell the User" section with ANY content, you MUST write a message to the user. Do NOT reply HEARTBEAT_OK in that case. Say something — even one sentence is fine.

1. Read the signals carefully. Check urgency, mode, and should_act.
2. If \`should_act\` is true — you MUST send a message. Use the "Tell the User" or "Action Brief" section as guidance for what to say. Keep it natural and brief.
3. If mode is \`act\` — take action immediately. Do what the signal says.
4. If mode is \`suggest\` and urgency is not \`none\` — surface the suggestion naturally.
5. ONLY reply HEARTBEAT_OK if \`should_act\` is false AND there is truly nothing in the signals worth mentioning.

Do not repeat old tasks from prior conversations. Only act on what the signals say right now.
`;

/**
 * Write HEARTBEAT.md to the workspace if it doesn't exist or is effectively empty.
 */
export function ensureHeartbeatMd(api: PluginApi): void {
  try {
    const heartbeatPath = join(api.resolvePath('.'), HEARTBEAT_FILENAME);

    if (existsSync(heartbeatPath)) {
      // Check if file is effectively empty (only comments/whitespace)
      const content = readFileSync(heartbeatPath, 'utf-8');
      const hasContent = content
        .split('\n')
        .some((line: string) => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('#');
        });
      if (hasContent) return; // File has real content, don't overwrite
    }

    writeFileSync(heartbeatPath, HEARTBEAT_TEMPLATE, 'utf-8');
    api.logger.info(`keyoku: created ${HEARTBEAT_FILENAME} for heartbeat support`);
  } catch (err) {
    api.logger.warn(`keyoku: could not create ${HEARTBEAT_FILENAME}: ${String(err)}`);
  }
}
