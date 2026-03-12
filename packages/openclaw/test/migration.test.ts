import { describe, it, expect, vi } from 'vitest';
import { chunkByHeadings, importMemoryFiles } from '../src/migration.js';

describe('chunkByHeadings', () => {
  it('splits content by ## headings', () => {
    const content = '## Section A\nContent A\n\n## Section B\nContent B';
    const chunks = chunkByHeadings(content);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toContain('Section A');
    expect(chunks[0].section).toBe('Section A');
    expect(chunks[1].content).toContain('Section B');
  });

  it('handles ### headings', () => {
    const content = '### Sub A\nContent A\n\n### Sub B\nContent B';
    const chunks = chunkByHeadings(content);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].section).toBe('Sub A');
  });

  it('captures content before first heading', () => {
    const content = 'Preamble text with enough content to be kept.\n\n## Section A\nContent A';
    const chunks = chunkByHeadings(content);
    // Should have preamble + section
    const preambleChunk = chunks.find((c) => c.content.includes('Preamble'));
    expect(preambleChunk).toBeDefined();
  });

  it('splits by --- separators when no headings', () => {
    const content = 'Block one with content.\n\n---\n\nBlock two with content.';
    const chunks = chunkByHeadings(content);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('splits by paragraphs when no structure', () => {
    const content = 'First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.';
    const chunks = chunkByHeadings(content);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('skips tiny sections (< 10 chars)', () => {
    const content = '## A\nHi\n\n## B\nThis section has enough content to be kept.';
    const chunks = chunkByHeadings(content);
    // First section "## A\nHi" is only ~7 chars, should be skipped
    expect(chunks.every((c) => c.content.length >= 10)).toBe(true);
  });

  it('handles empty content', () => {
    expect(chunkByHeadings('')).toHaveLength(0);
  });

  it('splits large sections by paragraphs', () => {
    const longSection = '## Big Section\n\n' + Array(20).fill('This is a paragraph with some content in it.').join('\n\n');
    const chunks = chunkByHeadings(longSection, 200);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.section === 'Big Section')).toBe(true);
  });
});

describe('importMemoryFiles', () => {
  function createMockClient() {
    return {
      search: vi.fn().mockResolvedValue([]),
      remember: vi.fn().mockResolvedValue({ memories_created: 1 }),
    };
  }

  it('returns zero counts when no files found', async () => {
    const client = createMockClient();
    const result = await importMemoryFiles({
      client: client as any,
      entityId: 'test',
      workspaceDir: '/nonexistent/path',
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });

  it('respects dryRun mode', async () => {
    const client = createMockClient();
    // Use a real temp dir with a MEMORY.md file
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const tmpDir = mkdtempSync(join(process.env.TMPDIR || '/tmp', 'keyoku-test-'));

    try {
      writeFileSync(join(tmpDir, 'MEMORY.md'), '## Test\nSome test content for dry run verification.');

      const result = await importMemoryFiles({
        client: client as any,
        entityId: 'test',
        workspaceDir: tmpDir,
        dryRun: true,
        logger: { info: vi.fn(), warn: vi.fn() },
      });

      expect(result.imported).toBeGreaterThan(0);
      expect(client.remember).not.toHaveBeenCalled();
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('skips duplicates based on similarity search', async () => {
    const client = createMockClient();
    client.search.mockResolvedValue([{ memory: { content: 'duplicate' }, similarity: 0.98 }]);

    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { join } = await import('node:path');
    const tmpDir = mkdtempSync(join(process.env.TMPDIR || '/tmp', 'keyoku-test-'));

    try {
      writeFileSync(join(tmpDir, 'MEMORY.md'), '## Test\nSome content that already exists in keyoku.');

      const result = await importMemoryFiles({
        client: client as any,
        entityId: 'test',
        workspaceDir: tmpDir,
        logger: { info: vi.fn(), warn: vi.fn() },
      });

      expect(result.skipped).toBeGreaterThan(0);
      expect(client.remember).not.toHaveBeenCalled();
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});
