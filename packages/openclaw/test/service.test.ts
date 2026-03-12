import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findKeyokuBinary, loadKeyokuEnv } from '../src/service.js';
import * as fs from 'node:fs';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof fs>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe('findKeyokuBinary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds binary at ~/.keyoku/bin/keyoku', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).includes('.keyoku/bin/keyoku');
    });

    const result = findKeyokuBinary();
    expect(result).toContain('.keyoku/bin/keyoku');
  });

  it('falls back to PATH when no local binary found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = findKeyokuBinary();
    expect(result).toBe('keyoku');
  });

  it('checks ~/.local/bin/keyoku as second candidate', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => {
      return String(p).includes('.local/bin/keyoku');
    });

    const result = findKeyokuBinary();
    expect(result).toContain('.local/bin/keyoku');
  });
});

describe('loadKeyokuEnv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses key=value pairs from .env file', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      'OPENAI_API_KEY=sk-test123\nKEYOKU_DB_PATH=/data/keyoku.db\n',
    );

    const vars = loadKeyokuEnv();
    expect(vars.OPENAI_API_KEY).toBe('sk-test123');
    expect(vars.KEYOKU_DB_PATH).toBe('/data/keyoku.db');
  });

  it('skips comments and blank lines', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      '# This is a comment\n\nKEY=value\n  # Another comment\n',
    );

    const vars = loadKeyokuEnv();
    expect(vars.KEY).toBe('value');
    expect(Object.keys(vars)).toHaveLength(1);
  });

  it('returns empty object if file missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const vars = loadKeyokuEnv();
    expect(vars).toEqual({});
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('handles values containing equals sign', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('URL=postgres://user:pass@host/db?opt=1\n');

    const vars = loadKeyokuEnv();
    expect(vars.URL).toBe('postgres://user:pass@host/db?opt=1');
  });
});
