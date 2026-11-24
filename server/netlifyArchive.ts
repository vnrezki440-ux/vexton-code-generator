import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const NETLIFY_ARCHIVE_FILENAME = 'vexton-vpn-netlify-ready.zip';

const EXCLUDED_DIRS = new Set([
  '.aistudio',
  'node_modules',
  'data',
  '.playwright-cli',
  '.netlify',
  'dist',
  '.git',
  '__pycache__',
]);

const REQUIRED_ARCHIVE_ENTRIES = [
  'netlify.toml',
  'netlify/functions/api.ts',
  'netlify/lib/store.ts',
  'package.json',
  'public/_redirects',
  'public/favicon.svg',
  'src/App.tsx',
  '.env.example',
  'NETLIFY_DEPLOY.md',
];

export interface ZipEntryInput {
  name: string;
  data: Buffer;
  mtime?: Date;
}

export interface ArchiveBuildResult {
  primaryPath: string;
  persistentPath?: string;
  sizeBytes: number;
  fileCount: number;
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = Math.floor(date.getUTCSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

/**
 * Builds a valid standard PKZIP buffer using Node.js built-in zlib (no external dependencies).
 */
export function buildZipBuffer(entries: ZipEntryInput[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const normalizedName = entry.name.replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBuf = Buffer.from(normalizedName, 'utf8');
    const uncompressed = entry.data;
    const crc = zlib.crc32(uncompressed) >>> 0;

    let method = 0;
    let payload = uncompressed;
    if (uncompressed.length > 0) {
      const deflated = zlib.deflateRawSync(uncompressed, { level: 9 });
      if (deflated.length < uncompressed.length) {
        method = 8;
        payload = deflated;
      }
    }

    const { dosTime, dosDate } = toDosDateTime(entry.mtime ?? new Date());
    const flags = 0x0800; // UTF-8 filename encoding

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract (2.0)
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(uncompressed.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // Extra field length

    localParts.push(localHeader, nameBuf, payload);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(uncompressed.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // Extra length
    centralHeader.writeUInt16LE(0, 32); // Comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number start
    centralHeader.writeUInt16LE(0, 36); // Internal attributes
    centralHeader.writeUInt32LE(0, 38); // External attributes
    centralHeader.writeUInt32LE(offset, 42); // Relative offset of local header

    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralDirBuffer = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0); // End of central directory signature
  endRecord.writeUInt16LE(0, 4); // Disk number
  endRecord.writeUInt16LE(0, 6); // Start disk
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirBuffer.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localParts, centralDirBuffer, endRecord]);
}

function shouldExcludeFile(filename: string): boolean {
  if (
    filename.endsWith('.zip') ||
    filename.endsWith('.tmp') ||
    filename === 'bun.lock'
  ) {
    return true;
  }
  if (filename.includes('.db')) {
    return true;
  }
  if (filename.startsWith('.env') && filename !== '.env.example') {
    return true;
  }
  return false;
}

export function collectNetlifyProjectEntries(rootDir: string): ZipEntryInput[] {
  const collected: ZipEntryInput[] = [];

  const walk = (currentDir: string) => {
    const dirents = fs.readdirSync(currentDir, { withFileTypes: true });
    dirents.sort((a, b) => a.name.localeCompare(b.name));

    for (const dirent of dirents) {
      if (dirent.isDirectory()) {
        if (EXCLUDED_DIRS.has(dirent.name)) {
          continue;
        }
        walk(path.join(currentDir, dirent.name));
        continue;
      }

      if (!dirent.isFile() || shouldExcludeFile(dirent.name)) {
        continue;
      }

      const fullPath = path.join(currentDir, dirent.name);
      const relPath = path.relative(rootDir, fullPath).split(path.sep).join('/');
      const stat = fs.statSync(fullPath);
      const data = fs.readFileSync(fullPath);
      collected.push({
        name: relPath,
        data,
        mtime: stat.mtime,
      });
    }
  };

  walk(rootDir);
  return collected;
}

function writeFileAtomically(targetPath: string, data: Buffer): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, data);
  fs.renameSync(tmpPath, targetPath);
}

/**
 * Ensures the Netlify-ready ZIP archive exists in the project root and optional persistent directory.
 */
export function ensureNetlifyExportArchive(
  rootDir: string,
  options: {
    persistentDir?: string;
    forceRebuild?: boolean;
  } = {}
): ArchiveBuildResult {
  const primaryPath = path.resolve(rootDir, NETLIFY_ARCHIVE_FILENAME);
  const persistentPath = options.persistentDir
    ? path.resolve(options.persistentDir, NETLIFY_ARCHIVE_FILENAME)
    : undefined;

  if (!options.forceRebuild) {
    const existingPrimaryValid =
      fs.existsSync(primaryPath) && fs.statSync(primaryPath).size > 0;
    if (existingPrimaryValid) {
      const sizeBytes = fs.statSync(primaryPath).size;
      if (
        persistentPath &&
        persistentPath !== primaryPath &&
        (!fs.existsSync(persistentPath) || fs.statSync(persistentPath).size !== sizeBytes)
      ) {
        writeFileAtomically(persistentPath, fs.readFileSync(primaryPath));
      }
      return {
        primaryPath,
        persistentPath,
        sizeBytes,
        fileCount: 0,
      };
    }

    if (
      persistentPath &&
      fs.existsSync(persistentPath) &&
      fs.statSync(persistentPath).size > 0
    ) {
      const buf = fs.readFileSync(persistentPath);
      writeFileAtomically(primaryPath, buf);
      return {
        primaryPath,
        persistentPath,
        sizeBytes: buf.length,
        fileCount: 0,
      };
    }
  }

  const entries = collectNetlifyProjectEntries(rootDir);
  const entryNames = new Set(entries.map((entry) => entry.name));
  for (const required of REQUIRED_ARCHIVE_ENTRIES) {
    if (!entryNames.has(required)) {
      throw new Error(`Отсутствует обязательный файл проекта для архива: ${required}`);
    }
  }

  const zipBuffer = buildZipBuffer(entries);
  if (zipBuffer.length < 1024) {
    throw new Error('Сформированный ZIP-архив оказался пустым или повреждённым');
  }

  writeFileAtomically(primaryPath, zipBuffer);
  if (persistentPath && persistentPath !== primaryPath) {
    writeFileAtomically(persistentPath, zipBuffer);
  }

  return {
    primaryPath,
    persistentPath,
    sizeBytes: zipBuffer.length,
    fileCount: entries.length,
  };
}
