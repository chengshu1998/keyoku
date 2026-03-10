/**
 * OpenClaw lifecycle hook registrations.
 * - before_prompt_build: auto-recall + heartbeat injection
 * - agent_end: auto-capture memorable facts
 */

import type { KeyokuClient } from '@keyoku/memory';
import type { KeyokuConfig } from './config.js';
import { formatMemoryContext, formatHeartbeatContext } from './context.js';
import { extractCapturableTexts } from './capture.js';
import type { PluginApi } from './types.js';

export function registerHooks(
  api: PluginApi,
  client: KeyokuClient,
  entityId: string,
  agentId: string,
  config: Required<KeyokuConfig>,
): void {
  // before_prompt_build: inject relevant memories + heartbeat data
  if (config.autoRecall || config.heartbeat) {
    api.on('before_prompt_build', async (event: unknown) => {
      const ev = event as { prompt?: string; messages?: unknown[] };
      if (!ev.prompt || ev.prompt.length < 5) return;

      const parts: string[] = [];

      // Auto-recall: search for relevant memories
      if (config.autoRecall) {
        try {
          const results = await client.search(entityId, ev.prompt, { limit: config.topK, min_score: 0.1 });
          if (results.length > 0) {
            const ctx = formatMemoryContext(results);
            if (ctx) parts.push(ctx);
            api.logger.info?.(`keyoku: injected ${results.length} memories into context`);
          }
        } catch (err) {
          api.logger.warn(`keyoku: recall failed: ${String(err)}`);
        }
      }

      // Heartbeat enhancement: detect heartbeat runs and inject Keyoku data
      if (config.heartbeat && ev.prompt.includes('HEARTBEAT')) {
        try {
          const hb = await client.heartbeatCheck(entityId, {
            agent_id: agentId,
            max_results: 10,
          });
          const ctx = formatHeartbeatContext(hb);
          if (ctx) parts.push(ctx);
          api.logger.info?.(`keyoku: injected heartbeat data (should_act: ${hb.should_act})`);
        } catch (err) {
          api.logger.warn(`keyoku: heartbeat check failed: ${String(err)}`);
        }
      }

      if (parts.length > 0) {
        return { prependContext: parts.join('\n\n') };
      }
    });
  }

  // agent_end: auto-capture memorable facts from conversation
  if (config.autoCapture) {
    api.on('agent_end', async (event: unknown) => {
      const ev = event as { messages?: unknown[]; success?: boolean };
      if (!ev.success || !ev.messages || ev.messages.length === 0) return;

      try {
        const toCapture = extractCapturableTexts(ev.messages, config.captureMaxChars);
        if (toCapture.length === 0) return;

        let stored = 0;
        // Limit to 3 captures per conversation to avoid noise
        for (const text of toCapture.slice(0, 3)) {
          await client.remember(entityId, text, { agent_id: agentId, source: 'auto-capture' });
          stored++;
        }

        if (stored > 0) {
          api.logger.info(`keyoku: auto-captured ${stored} memories`);
        }
      } catch (err) {
        api.logger.warn(`keyoku: capture failed: ${String(err)}`);
      }
    });
  }
}
