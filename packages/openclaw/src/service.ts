/**
 * Keyoku binary lifecycle management.
 * Starts/stops the Keyoku Go binary as a child process.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import type { PluginApi } from './types.js';

let keyokuProcess: ChildProcess | null = null;

/**
 * Check if Keyoku is already running by attempting a health check.
 */
async function isKeyokuRunning(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Find keyoku binary on PATH or in common locations.
 */
function findKeyokuBinary(): string | null {
  // Try common locations
  const candidates = [
    'keyoku',
    resolve(process.env.HOME ?? '', '.keyoku', 'bin', 'keyoku'),
    resolve(process.env.HOME ?? '', '.local', 'bin', 'keyoku'),
  ];

  // Just return the name and let spawn handle PATH resolution
  return candidates[0];
}

export function registerService(api: PluginApi, keyokuUrl: string): void {
  api.registerService({
    id: 'keyoku-engine',

    async start() {
      // Skip if already running
      if (await isKeyokuRunning(keyokuUrl)) {
        api.logger.info('keyoku: Keyoku already running');
        return;
      }

      const binary = findKeyokuBinary();
      if (!binary) {
        api.logger.warn('keyoku: Keyoku binary not found — memory features require Keyoku to be running');
        return;
      }

      try {
        keyokuProcess = spawn(binary, [], {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
          env: { ...process.env },
        });

        keyokuProcess.on('error', (err) => {
          api.logger.warn(`keyoku: Failed to start Keyoku: ${err.message}`);
          keyokuProcess = null;
        });

        keyokuProcess.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            api.logger.warn(`keyoku: Keyoku exited with code ${code}`);
          }
          keyokuProcess = null;
        });

        // Wait briefly for startup
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (await isKeyokuRunning(keyokuUrl)) {
          api.logger.info('keyoku: Keyoku started successfully');
        } else {
          api.logger.warn('keyoku: Keyoku started but health check failed — it may still be initializing');
        }
      } catch (err) {
        api.logger.warn(`keyoku: Could not start Keyoku: ${String(err)}`);
      }
    },

    stop() {
      if (keyokuProcess) {
        keyokuProcess.kill('SIGTERM');
        keyokuProcess = null;
        api.logger.info('keyoku: Keyoku stopped');
      }
    },
  });
}
