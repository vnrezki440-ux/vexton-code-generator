import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildZipBuffer,
  collectNetlifyProjectEntries,
  ensureNetlifyExportArchive,
  NETLIFY_ARCHIVE_FILENAME,
} from './netlifyArchive.ts';

test('buildZipBuffer produces valid PKZIP binary data with local & central directory headers', () => {
  const buf = buildZipBuffer([
    { name: 'hello.txt', data: Buffer.from('VEXTON VPN Test Payload', 'utf8') },
    { name: 'nested/empty.txt', data: Buffer.alloc(0) },
  ]);

  assert.equal(buf.subarray(0, 4).toString('binary'), 'PK\x03\x04');
  assert.ok(buf.includes(Buffer.from('hello.txt', 'utf8')));
  assert.ok(buf.includes(Buffer.from('nested/empty.txt', 'utf8')));
  // End of central directory signature PK\x05\x06 near end
  assert.equal(buf.subarray(buf.length - 22, buf.length - 18).toString('binary'), 'PK\x05\x06');
});

test('ensureNetlifyExportArchive collects full project without secrets and saves non-empty ZIP in primary and persistent paths', () => {
  const rootDir = process.cwd();
  const tempPersistentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vexton-zip-persist-'));

  try {
    const entries = collectNetlifyProjectEntries(rootDir);
    const names = new Set(entries.map((e) => e.name));

    for (const reqFile of [
      'netlify.toml',
      'netlify/functions/api.ts',
      'netlify/lib/store.ts',
      'src/App.tsx',
      'public/_redirects',
      'public/favicon.svg',
      'package.json',
      '.env.example',
    ]) {
      assert.equal(names.has(reqFile), true, `Missing required file in entries: ${reqFile}`);
    }

    assert.equal(
      entries.some((e) => e.name.startsWith('node_modules/') || e.name.startsWith('data/')),
      false
    );
    assert.equal(
      entries.some((e) => e.name === '.env' || e.name.endsWith('.db')),
      false
    );

    const res = ensureNetlifyExportArchive(rootDir, {
      persistentDir: tempPersistentDir,
      forceRebuild: true,
    });

    assert.ok(res.sizeBytes > 20_000, 'Expected non-empty Netlify archive');
    assert.ok(res.fileCount >= 30);
    assert.equal(fs.existsSync(res.primaryPath), true);
    assert.ok(res.persistentPath && fs.existsSync(res.persistentPath));
    assert.equal(
      fs.statSync(res.primaryPath).size,
      fs.statSync(res.persistentPath!).size
    );

    const header = fs.readFileSync(res.primaryPath).subarray(0, 4).toString('binary');
    assert.equal(header, 'PK\x03\x04');
    assert.equal(path.basename(res.primaryPath), NETLIFY_ARCHIVE_FILENAME);
  } finally {
    fs.rmSync(tempPersistentDir, { recursive: true, force: true });
  }
});
