/**
 * `npx @keyoku/openclaw update-engine`
 *
 * Downloads the latest keyoku-engine binary from GitHub releases,
 * replacing the existing binary at ~/.keyoku/bin/keyoku.
 */

import { existsSync, mkdirSync, chmodSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const HOME = process.env.HOME ?? '';
const KEYOKU_BIN_DIR = join(HOME, '.keyoku', 'bin');
const KEYOKU_BIN_PATH = join(KEYOKU_BIN_DIR, 'keyoku');

function getPlatformInfo(): { os: string; arch: string } {
  const osMap: Record<string, string> = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'windows',
  };
  const archMap: Record<string, string> = {
    x64: 'amd64',
    arm64: 'arm64',
  };
  return {
    os: osMap[process.platform] ?? process.platform,
    arch: archMap[process.arch] ?? process.arch,
  };
}

export async function updateEngine(): Promise<void> {
  const { os, arch } = getPlatformInfo();
  const assetName = `keyoku-server-${os}-${arch}${os === 'windows' ? '.exe' : ''}`;
  const hasExisting = existsSync(KEYOKU_BIN_PATH);

  console.log(`Platform: ${os}/${arch}`);
  console.log(hasExisting ? `Existing binary: ${KEYOKU_BIN_PATH}` : 'No existing binary found.');
  console.log('Fetching latest release...');

  const releaseRes = await fetch(
    'https://api.github.com/repos/keyoku-ai/keyoku-engine/releases/latest',
    { headers: { Accept: 'application/vnd.github.v3+json' } },
  );

  if (!releaseRes.ok) {
    console.error(`Failed to fetch release info: ${releaseRes.status} ${releaseRes.statusText}`);
    process.exit(1);
  }

  const release = (await releaseRes.json()) as {
    tag_name: string;
    assets: Array<{ name: string; browser_download_url: string }>;
  };

  const asset = release.assets.find((a) => a.name === assetName);
  if (!asset) {
    console.error(`No binary found for ${os}/${arch} in release ${release.tag_name}`);
    console.error(`Available: ${release.assets.map((a) => a.name).join(', ')}`);
    process.exit(1);
  }

  console.log(`Downloading ${release.tag_name} (${asset.name})...`);

  const downloadRes = await fetch(asset.browser_download_url);
  if (!downloadRes.ok || !downloadRes.body) {
    console.error(`Download failed: ${downloadRes.status}`);
    process.exit(1);
  }

  mkdirSync(KEYOKU_BIN_DIR, { recursive: true });

  const fileStream = createWriteStream(KEYOKU_BIN_PATH);
  // @ts-expect-error — Node fetch body is a ReadableStream, pipeline handles it
  await pipeline(downloadRes.body, fileStream);

  if (os !== 'windows') {
    chmodSync(KEYOKU_BIN_PATH, 0o755);
  }

  console.log(`${hasExisting ? 'Updated' : 'Installed'} ${release.tag_name} → ${KEYOKU_BIN_PATH}`);
  console.log('');
  console.log('To apply the update, restart the engine:');
  console.log(`  kill $(pgrep -f keyoku) && ${KEYOKU_BIN_PATH}`);
}
