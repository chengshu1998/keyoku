/**
 * Auto-generates HEARTBEAT.md so that OpenClaw's heartbeat runner
 * actually fires the heartbeat (empty file = skip).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PluginApi } from './types.js';

const HEARTBEAT_FILENAME = 'HEARTBEAT.md';

const HEARTBEAT_TEMPLATE = `# Heartbeat Check

You have been checked in on. Your memory system (Keyoku) has reviewed your recent activity and surfaced anything that needs your attention. The signals are injected into your context automatically — look for the <keyoku-heartbeat> block.

Review the signals alongside what you have been working on. Act on anything that is relevant right now. If nothing needs attention, reply HEARTBEAT_OK.
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
