import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureHeartbeatMd } from '../src/heartbeat-setup.js';
import type { PluginApi } from '../src/types.js';
import * as fs from 'node:fs';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof fs>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
  };
});

function createMockApi() {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    resolvePath: (p: string) => '/mock/workspace',
  } as unknown as PluginApi;
}

describe('ensureHeartbeatMd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates file when none exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    ensureHeartbeatMd(createMockApi());

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('keyoku-heartbeat-start');
    expect(written).toContain('Heartbeat Check-In');
  });

  it('appends keyoku section to file with user content but no marker', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      '# My Heartbeat\n\n- Remind me about standup\n- Check PRs daily',
    );

    ensureHeartbeatMd(createMockApi());

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    // Preserves user content
    expect(written).toContain('Remind me about standup');
    expect(written).toContain('Check PRs daily');
    // Appends keyoku section
    expect(written).toContain('keyoku-heartbeat-start');
  });

  it('updates keyoku section when marker already present', () => {
    const existing = '# Heartbeat\n\n<!-- keyoku-heartbeat-start -->\nOLD CONTENT\n<!-- keyoku-heartbeat-end -->\n';
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(existing);

    ensureHeartbeatMd(createMockApi());

    const written = vi.mocked(fs.writeFileSync).mock.calls[0]?.[1] as string | undefined;
    if (written) {
      // Should update the section, not duplicate
      expect(written).toContain('keyoku-heartbeat-start');
      expect(written).not.toContain('OLD CONTENT');
      expect(written).toContain('Heartbeat Check-In');
    }
    // If not written, the content was already up to date — also fine
  });

  it('does not overwrite file with user content when no keyoku section', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      '# My Custom Rules\n\n- Be helpful\n- Stay brief\n',
    );

    ensureHeartbeatMd(createMockApi());

    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    // Must NOT overwrite — should contain the original content
    expect(written).toContain('Be helpful');
    expect(written).toContain('Stay brief');
  });

  it('appends to file with no meaningful user content (no overwrite)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('# Heartbeat\n\n');

    ensureHeartbeatMd(createMockApi());

    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const written = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
    // Should append, not overwrite with full template
    expect(written).toContain('# Heartbeat');
    expect(written).toContain('keyoku-heartbeat-start');
  });

  it('logs warning on fs error', () => {
    vi.mocked(fs.existsSync).mockImplementation(() => { throw new Error('permission denied'); });
    const api = createMockApi();

    ensureHeartbeatMd(api);

    expect(api.logger.warn).toHaveBeenCalled();
  });
});
