// src/utils/s3.ts
import 'server-only';

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  ObjectIdentifier,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { createGunzip } from 'zlib';
import { getServerEnv } from '@/config/env';

// --- ENV config ---
const env = getServerEnv();
const BUCKET = env.AWS_S3_BUCKET;
const REGION = env.AWS_S3_REGION;
const ENDPOINT = env.AWS_S3_ENDPOINT;
const ACCESS_KEY_ID = env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = env.AWS_SECRET_ACCESS_KEY;
const INVENTORY_BUCKET = env.AWS_S3_INVENTORY_BUCKET;
const INVENTORY_PREFIX = env.AWS_S3_INVENTORY_PREFIX;

const useS3 = !!(BUCKET && REGION && ENDPOINT && ACCESS_KEY_ID && SECRET_ACCESS_KEY);

let s3: S3Client | null = null;
const isBuildPhase =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-export';
const shouldLogStorageMode = process.env.NODE_ENV !== 'test' && !isBuildPhase;

if (useS3) {
  s3 = new S3Client({
    region: REGION!,
    endpoint: ENDPOINT!,
    forcePathStyle: true, // REG.RU / YOS / MinIO
    credentials: {
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_ACCESS_KEY!,
    },
  });
  if (shouldLogStorageMode) {
    console.log('✅ Using S3 storage');
  }
} else {
  if (shouldLogStorageMode) {
    console.log('⚙️ Using local file storage (no S3 config found)');
  }
}

/** Универсальный публичный URL для ключа */
function publicUrlForKey(key: string): string {
  if (s3 && BUCKET && ENDPOINT) {
    return `${ENDPOINT.replace(/\/+$/, '')}/${BUCKET}/${key}`;
  }
  // локальный режим: кладём в /public и отдаём как /<key>
  return `/${key.replace(/\\/g, '/')}`;
}

export function storageKeyFromPublicUrl(publicUrl: string): string | null {
  if (!publicUrl) {
    return null;
  }

  if (s3 && BUCKET && ENDPOINT) {
    const base = ENDPOINT.replace(/\/+$/, '');
    const prefix = `${base}/${BUCKET}/`;
    return publicUrl.startsWith(prefix) ? publicUrl.slice(prefix.length) : null;
  }

  if (/^https?:\/\//i.test(publicUrl)) {
    try {
      const url = new URL(publicUrl);
      return url.pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  }

  return publicUrl.replace(/^\/+/, '');
}

/** Гарантируем существование локальной директории под ключ */
function ensureLocalDirForKey(key: string): string {
  const full = path.join(process.cwd(), 'public', key);
  const dir = path.dirname(full);
  fs.mkdirSync(dir, { recursive: true });
  return full;
}

// Нормализация имени файла: убираем слеши/лишние пробелы и пытаемся починить latin1-кодировку
function normalizeFilename(raw: string): string {
  let base = path.basename(raw || 'file');
  const suspect = /[ÃÐÒÑÂäöüÄÖÜß]/.test(base);
  if (suspect) {
    try {
      const fixed = Buffer.from(base, 'latin1').toString('utf8');
      if (/[А-Яа-яЁё]/.test(fixed)) {
        base = fixed;
      }
    } catch {
      /* ignore */
    }
  }
  base = base.replace(/[/\\]+/g, '_').replace(/\s+/g, ' ').trim();
  return base || 'file';
}

/**
 * Загрузка по готовому ключу (используется в pages/api/upload.ts)
 * Возвращает ПУБЛИЧНЫЙ URL string.
 */
export async function uploadBuffer(
    fileBuffer: Buffer,
    key: string,
    contentType: string
): Promise<string> {
  if (s3 && BUCKET) {
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read', // если нужен приват — уберите
    });
    await s3.send(cmd);
    const url = publicUrlForKey(key);
    console.log(`✅ Uploaded to S3: ${url}`);
    return url;
  }

  // Локальный режим
  const fullPath = ensureLocalDirForKey(key);
  await fs.promises.writeFile(fullPath, fileBuffer);
  const url = publicUrlForKey(key);
  console.log(`💾 Saved locally: ${url}`);
  return url;
}

/** Сборка ключа вида: uploads/<TASKID>/<TASKID>-<subfolder>/<filename> */
const sanitizePathSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_-]/g, '').trim();

function sanitizeTaskId(taskId: string): string {
  return sanitizePathSegment(taskId);
}

export type TaskFileSubfolder =
  | 'estimate'
  | 'attachments'
  | 'order'
  | 'comments'
  | 'ncw'
  | 'documents'
  | 'document-review'
  | 'document-final';

export function buildTaskFileKey(
    taskId: string,
    subfolder: TaskFileSubfolder,
    filename: string,
    opts?: { orgSlug?: string; projectKey?: string }
): string {
  const safeTaskId = sanitizeTaskId(taskId);
  const safeName = normalizeFilename(filename);
  const parts = ['uploads'];

  const safeOrg = opts?.orgSlug ? sanitizePathSegment(opts.orgSlug) : '';
  const safeProject = opts?.projectKey ? sanitizePathSegment(opts.projectKey) : '';

  if (safeOrg) parts.push(safeOrg);
  if (safeProject) parts.push(safeProject);

  parts.push(`${safeTaskId}`, `${safeTaskId}-${subfolder}`, safeName);

  return path.posix.join(...parts);
}

export type MessengerMediaKind = 'image' | 'video';

export function buildMessengerMediaKey(params: {
  orgSlug?: string;
  orgId?: string;
  conversationId: string;
  filename: string;
}): string {
  const safeOrg = params.orgSlug ? sanitizePathSegment(params.orgSlug) : '';
  const safeOrgId = params.orgId ? sanitizePathSegment(params.orgId) : '';
  const safeConversationId = sanitizePathSegment(params.conversationId);
  const safeName = normalizeFilename(params.filename);
  const parts = ['uploads'];

  if (safeOrg) {
    parts.push(safeOrg);
  } else if (safeOrgId) {
    parts.push(`org-${safeOrgId}`);
  }

  parts.push('messenger', safeConversationId, safeName);

  return path.posix.join(...parts);
}

/**
 * Загрузка файла задачи в S3/локально.
 * subfolder — один из предопределённых подкаталогов;
 * ключ остаётся в формате uploads/<TASKID>/<TASKID>-<subfolder>/<filename>.
 */
export async function uploadTaskFile(
    fileBuffer: Buffer,
    taskId: string,
    subfolder: TaskFileSubfolder,
    filename: string,
    contentType: string,
    opts?: { orgSlug?: string; projectKey?: string }
): Promise<string> {
  const key = buildTaskFileKey(taskId, subfolder, filename, opts);

  if (s3 && BUCKET) {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read',
    });
    await s3.send(command);
    const url = publicUrlForKey(key);
    console.log(`✅ Uploaded to S3: ${url}`);
    return url;
  }

  // Локальный режим
  const fullPath = ensureLocalDirForKey(key);
  await fs.promises.writeFile(fullPath, fileBuffer);
  const url = publicUrlForKey(key);
  console.log(`💾 Saved locally: ${url}`);
  return url;
}

/** Удаление файла по публичному URL (S3 или локально) */
export async function deleteTaskFile(publicUrl: string): Promise<void> {
  try {
    if (s3 && BUCKET && ENDPOINT) {
      const base = ENDPOINT.replace(/\/+$/, '');
      const prefix = `${base}/${BUCKET}/`;
      if (!publicUrl.startsWith(prefix)) {
        console.warn('⚠️ URL не совпадает с S3-префиксом, пропускаем удаление');
        return;
      }
      const key = publicUrl.slice(prefix.length);
      const cmd = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
      await s3.send(cmd);
      console.log(`🗑️ Deleted from S3: ${publicUrl}`);
      return;
    }

    // локальный режим
    const relative = publicUrl.replace(/^\/+/, '');
    const localPath = path.join(process.cwd(), 'public', relative);
  if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath);
      console.log(`🗑️ Deleted locally: ${localPath}`);
    } else {
      console.log(`ℹ️ Local file not found: ${localPath}`);
    }
  } catch (err) {
    console.error('Ошибка при удалении файла:', err);
  }
}

export async function deleteStoragePrefix(prefix: string): Promise<void> {
  const normalizedPrefix = prefix.replace(/^\/+/, '').replace(/\/?$/, '/');
  if (!normalizedPrefix || normalizedPrefix === '/') {
    console.warn('⚠️ Empty prefix, skip storage delete');
    return;
  }

  if (s3 && BUCKET) {
    let continuationToken: string | undefined = undefined;

    do {
      const { Contents = [], IsTruncated, NextContinuationToken } =
        await s3.send(new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: normalizedPrefix,
          ContinuationToken: continuationToken,
        })) as ListObjectsV2CommandOutput;

      const keys = Contents.map(({ Key }) => Key).filter(
        (key): key is string => typeof key === 'string' && key.trim().length > 0
      );

      if (keys.length > 0) {
        const deleteCmd = new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: {
            Objects: keys.map(
              (Key): ObjectIdentifier => ({
                Key,
              })
            ),
            Quiet: true,
          },
        });
        await s3.send(deleteCmd);
        console.log(`🗑️ Deleted ${keys.length} objects from S3 prefix ${normalizedPrefix}`);
      }

      continuationToken = IsTruncated ? NextContinuationToken : undefined;
    } while (continuationToken);

    return;
  }

  const localDir = path.join(process.cwd(), 'public', normalizedPrefix);
  await fs.promises.rm(localDir, { recursive: true, force: true });
  console.log(`🗑️ Deleted local folder: ${localDir}`);
}

/** Полное удаление папки задачи uploads/<TASKID>/ со всеми вложениями (S3 или локально) */
export async function deleteTaskFolder(
    taskId: string,
    orgSlug?: string,
    projectKey?: string
): Promise<void> {
  const safeTaskId = sanitizeTaskId(taskId);
  const safeOrg = orgSlug ? sanitizeTaskId(orgSlug) : '';
  const safeProject = projectKey ? sanitizeTaskId(projectKey) : '';
  if (!safeTaskId) {
    console.warn('⚠️ Пустой taskId, пропускаем удаление папки');
    return;
  }

  const prefixes = Array.from(
    new Set([
      `${path.posix.join('uploads', safeTaskId)}/`,
      safeOrg ? `${path.posix.join('uploads', safeOrg, safeTaskId)}/` : null,
      safeOrg && safeProject
        ? `${path.posix.join('uploads', safeOrg, safeProject, safeTaskId)}/`
        : null,
    ].filter(Boolean) as string[])
  );

  for (const prefix of prefixes) {
    if (s3 && BUCKET) {
      let continuationToken: string | undefined = undefined;

      do {
        const { Contents = [], IsTruncated, NextContinuationToken } =
          await s3.send(new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })) as ListObjectsV2CommandOutput;

        const keys = Contents.map(({ Key }) => Key).filter(
          (key): key is string => typeof key === 'string' && key.trim().length > 0
        );

        if (keys.length > 0) {
          const deleteCmd = new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: {
              Objects: keys.map(
                (Key): ObjectIdentifier => ({
                  Key,
                })
              ),
              Quiet: true,
            },
          });
          await s3.send(deleteCmd);
          console.log(`🗑️ Deleted ${keys.length} objects from S3 prefix ${prefix}`);
        }

        continuationToken = IsTruncated ? NextContinuationToken : undefined;
      } while (continuationToken);

      continue;
    }

    const localDir = path.join(process.cwd(), 'public', prefix);
    await fs.promises.rm(localDir, { recursive: true, force: true });
    console.log(`🗑️ Deleted local task folder: ${localDir}`);
  }
}

async function getLocalDirSize(targetPath: string): Promise<number> {
  try {
    const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const full = path.join(targetPath, entry.name);
      if (entry.isDirectory()) {
        total += await getLocalDirSize(full);
      } else if (entry.isFile()) {
        const stats = await fs.promises.stat(full);
        total += stats.size;
      }
    }
    return total;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'ENOENT') {
      return 0;
    }
    throw err;
  }
}

export async function sumStorageBytes(prefix: string): Promise<number> {
  const normalizedPrefix = prefix.replace(/^\/+/, '').replace(/\/?$/, '/');
  if (!normalizedPrefix || normalizedPrefix === '/') {
    throw new Error('INVALID_STORAGE_PREFIX');
  }

  if (s3 && BUCKET) {
    let continuationToken: string | undefined = undefined;
    let total = 0;

    do {
      const { Contents = [], IsTruncated, NextContinuationToken } =
        await s3.send(new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: normalizedPrefix,
          ContinuationToken: continuationToken,
        })) as ListObjectsV2CommandOutput;

      for (const item of Contents) {
        if (typeof item.Size === 'number' && item.Size > 0) {
          total += item.Size;
        }
      }

      continuationToken = IsTruncated ? NextContinuationToken : undefined;
    } while (continuationToken);

    return total;
  }

  const localDir = path.join(process.cwd(), 'public', normalizedPrefix);
  return await getLocalDirSize(localDir);
}

type InventoryConfig = {
  bucket: string;
  prefix: string;
};

type InventoryManifest = {
  fileSchema?: string;
  files?: Array<{ key: string }>;
};

const getInventoryConfig = (): InventoryConfig | null => {
  if (!INVENTORY_BUCKET || !INVENTORY_PREFIX) return null;
  const prefix = INVENTORY_PREFIX.replace(/^\/+/, '').replace(/\/?$/, '/');
  if (!prefix) return null;
  return { bucket: INVENTORY_BUCKET, prefix };
};

const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
};

const readStreamToString = async (body: Readable): Promise<string> => {
  let data = '';
  for await (const chunk of body) {
    data += chunk.toString('utf8');
  }
  return data;
};

const findLatestInventoryManifestKey = async (config: InventoryConfig): Promise<string | null> => {
  if (!s3) return null;
  let continuationToken: string | undefined = undefined;
  let latestKey: string | null = null;
  let latestTime = 0;

  do {
    const { Contents = [], IsTruncated, NextContinuationToken } =
      await s3.send(new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: config.prefix,
        ContinuationToken: continuationToken,
      })) as ListObjectsV2CommandOutput;

    for (const item of Contents) {
      if (!item.Key || !item.Key.endsWith('manifest.json') || !item.LastModified) {
        continue;
      }
      const time = item.LastModified.getTime();
      if (time >= latestTime) {
        latestTime = time;
        latestKey = item.Key;
      }
    }

    continuationToken = IsTruncated ? NextContinuationToken : undefined;
  } while (continuationToken);

  return latestKey;
};

const loadInventoryManifest = async (config: InventoryConfig): Promise<InventoryManifest | null> => {
  if (!s3) return null;
  const manifestKey = await findLatestInventoryManifestKey(config);
  if (!manifestKey) return null;
  const response = await s3.send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: manifestKey,
  }));
  if (!response.Body) return null;
  const manifestText = await readStreamToString(response.Body as Readable);
  try {
    return JSON.parse(manifestText) as InventoryManifest;
  } catch {
    console.warn('⚠️ Failed to parse inventory manifest JSON');
    return null;
  }
};

const sumStorageBytesByOrgFromInventory = async (
  config: InventoryConfig,
  orgSlugs: string[]
): Promise<Map<string, number>> => {
  if (!s3) return new Map();
  const manifest = await loadInventoryManifest(config);
  if (!manifest?.fileSchema || !manifest.files?.length) {
    return new Map();
  }

  const columns = manifest.fileSchema.split(',').map((value) => value.trim());
  const keyIndex = columns.indexOf('Key');
  const sizeIndex = columns.indexOf('Size');
  const isLatestIndex = columns.indexOf('IsLatest');
  const deleteMarkerIndex = columns.indexOf('IsDeleteMarker');

  if (keyIndex < 0 || sizeIndex < 0) {
    throw new Error('INVENTORY_SCHEMA_MISSING_COLUMNS');
  }

  const normalized = orgSlugs.map(sanitizePathSegment).filter(Boolean);
  const allowed = new Set(normalized);
  const totals = new Map<string, number>();
  for (const slug of normalized) {
    totals.set(slug, 0);
  }

  for (const file of manifest.files) {
    if (!file.key) continue;
    const response = await s3.send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: file.key,
    }));
    if (!response.Body) continue;
    let stream = response.Body as Readable;
    if (file.key.endsWith('.gz')) {
      stream = stream.pipe(createGunzip());
    }

    let buffered = '';
    for await (const chunk of stream) {
      buffered += chunk.toString('utf8');
      const lines = buffered.split(/\r?\n/);
      buffered = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const fields = parseCsvLine(line);
        const key = fields[keyIndex] ?? '';
        if (!key.startsWith('uploads/')) continue;
        if (deleteMarkerIndex >= 0 && fields[deleteMarkerIndex] === 'true') continue;
        if (isLatestIndex >= 0 && fields[isLatestIndex] !== 'true') continue;
        const slug = key.slice('uploads/'.length).split('/')[0];
        if (!slug || (allowed.size > 0 && !allowed.has(slug))) continue;
        const sizeRaw = fields[sizeIndex] ?? '0';
        const size = Number.parseInt(sizeRaw, 10);
        if (Number.isNaN(size) || size <= 0) continue;
        totals.set(slug, (totals.get(slug) ?? 0) + size);
      }
    }
  }

  return totals;
};

export async function sumStorageBytesByOrg(orgSlugs: string[]): Promise<Map<string, number>> {
  const normalized = orgSlugs.map(sanitizePathSegment).filter(Boolean);
  const totals = new Map<string, number>();
  for (const slug of normalized) {
    totals.set(slug, 0);
  }

  const inventory = getInventoryConfig();
  if (inventory && s3) {
    try {
      const inventoryTotals = await sumStorageBytesByOrgFromInventory(inventory, normalized);
      for (const slug of normalized) {
        totals.set(slug, inventoryTotals.get(slug) ?? 0);
      }
      return totals;
    } catch {
      console.warn('⚠️ Inventory scan failed, fallback to ListObjectsV2');
    }
  }

  for (const slug of normalized) {
    const bytes = await sumStorageBytes(`uploads/${slug}/`);
    totals.set(slug, bytes);
  }

  return totals;
}
