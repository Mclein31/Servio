import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { and, eq, or } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { addonQuotes, bookings, bulletinRequests, messages, proProfiles, uploads as files, users } from '../db/schema';
import type { AppEnv, Bindings } from '../env';
import { timingSafeEqualString } from '../lib/crypto';
import { ApiError } from '../lib/errors';
import { UPLOAD_KEY, UPLOAD_TYPES, uploadSignature } from '../lib/uploads';
import { validate } from '../lib/validation';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';

export const UPLOAD_TTL_SECONDS = 900;
const DOWNLOAD_TTL_SECONDS = 60;
const Presign = v.pipe(v.strictObject({
  purpose: v.picklist(['addon_evidence', 'kyc', 'request_photo', 'avatar']),
  contentType: v.picklist(['image/jpeg', 'image/png', 'application/pdf']),
  contentLength: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(10 * 1024 * 1024)),
}), v.check((i) => i.contentLength <= UPLOAD_TYPES[i.contentType].max && (i.contentType !== 'application/pdf' || i.purpose === 'kyc'),
'JPEG/PNG up to 5 MB; PDF up to 10 MB for KYC only.'));

export const uploads = new Hono<AppEnv>();
uploads.use('/uploads/*', withDb);

function directUploadMode(env: Bindings): boolean {
  const mode = env.UPLOADS_MODE?.trim().toLowerCase();
  const environment = env.ENVIRONMENT?.trim().toLowerCase();
  if (mode === 'worker') return true;
  if (mode === 'local') return environment !== 'production' && environment !== 'prod';
  return false;
}
function s3(env: Bindings) {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !/^servio-/.test(env.R2_BUCKET_NAME)) {
    throw new ApiError(503, 'STORAGE_UNCONFIGURED', 'Configure SERVIO R2 credentials before uploading.');
  }
  return new S3Client({ requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', region: 'auto', endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, forcePathStyle: true,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY } });
}
function signaturePayload(method: string, row: typeof files.$inferSelect, expires: number) {
  return JSON.stringify([method, row.key, row.contentType, row.contentLength, expires]);
}
async function localUrl(base: string, env: Bindings, row: typeof files.$inferSelect, method: string, seconds: number) {
  const expires = Math.floor(Date.now() / 1000) + seconds;
  const signature = await uploadSignature(env.PIN_SECRET, signaturePayload(method, row, expires));
  return `${base}/uploads/blob/${row.key}?expires=${expires}&signature=${signature}`;
}
const missing = () => new ApiError(404, 'FILE_NOT_FOUND', 'File not found.');

uploads.post('/uploads/presign', requireUser, validate('json', Presign), async (c) => {
  const input = c.req.valid('json');
  const now = new Date();
  const key = `uploads/${input.purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${UPLOAD_TYPES[input.contentType].extension}`;
  const row = { ...input, key, ownerId: c.get('userId'), createdAt: now };
  const base = new URL(c.req.url).origin + '/api/v1';
  const uploadUrl = directUploadMode(c.env) ? await localUrl(base, c.env, row, 'PUT', UPLOAD_TTL_SECONDS)
    : await getSignedUrl(s3(c.env), new PutObjectCommand({ Bucket: c.env.R2_BUCKET_NAME, Key: key, ContentType: input.contentType, ContentLength: input.contentLength }),
      { expiresIn: UPLOAD_TTL_SECONDS, signableHeaders: new Set(['content-type', 'content-length']) });
  await c.get('db').insert(files).values(row);
  return c.json({ key, uploadUrl, method: 'PUT', headers: { 'Content-Type': input.contentType, 'Content-Length': String(input.contentLength) }, expiresAt: new Date(now.getTime() + UPLOAD_TTL_SECONDS * 1000).toISOString() }, 201);
});

async function capability(c: import('hono').Context<AppEnv>) {
  if (!directUploadMode(c.env)) throw missing();
  const key = c.req.param('key');
  if (!key || !UPLOAD_KEY.test(key)) throw missing();
  const [row] = await c.get('db').select().from(files).where(eq(files.key, key));
  const expires = Number(c.req.query('expires'));
  const ttl = c.req.method === 'PUT' ? UPLOAD_TTL_SECONDS : DOWNLOAD_TTL_SECONDS;
  if (!row || !Number.isInteger(expires) || expires <= Date.now() / 1000 || expires > Date.now() / 1000 + ttl) throw missing();
  const signature = await uploadSignature(c.env.PIN_SECRET, signaturePayload(c.req.method, row, expires));
  if (!timingSafeEqualString(signature, c.req.query('signature') ?? '')) throw missing();
  return row;
}

uploads.put('/uploads/blob/:key{.+}', async (c) => {
  const row = await capability(c);
  const reqContentType = c.req.header('Content-Type')?.split(';')[0]?.trim();
  const reqContentLength = c.req.header('Content-Length');
  if (reqContentType && reqContentType !== row.contentType) {
    throw new ApiError(422, 'UPLOAD_MISMATCH', 'Upload the exact declared type and length.');
  }
  if (reqContentLength && Number(reqContentLength) !== row.contentLength) {
    throw new ApiError(422, 'UPLOAD_MISMATCH', 'Upload the exact declared type and length.');
  }
  const reader = c.req.raw.body?.getReader();
  if (!reader) throw new ApiError(422, 'UPLOAD_MISMATCH', 'The file is empty.');
  const bytes = new Uint8Array(row.contentLength);
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    if (size + chunk.value.byteLength > row.contentLength) { await reader.cancel(); throw new ApiError(422, 'UPLOAD_MISMATCH', 'The file exceeds its declared length.'); }
    bytes.set(chunk.value, size); size += chunk.value.byteLength;
  }
  if (size !== row.contentLength) throw new ApiError(422, 'UPLOAD_MISMATCH', 'The file length does not match.');
  await c.env.UPLOADS.put(row.key, bytes, { httpMetadata: { contentType: row.contentType } });
  return c.json({ uploaded: true });
});

uploads.get('/uploads/blob/:key{.+}', async (c) => {
  const row = await capability(c);
  const object = await c.env.UPLOADS.get(row.key);
  if (!object) throw missing();
  return new Response(await object.arrayBuffer(), { headers: { 'Content-Type': row.contentType, 'Content-Length': String(object.size),
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
});

uploads.get('/uploads/:key{.+}', requireUser, async (c) => {
  const key = c.req.param('key');
  if (!UPLOAD_KEY.test(key)) throw missing();
  const db = c.get('db'); const userId = c.get('userId');
  const [row] = await db.select().from(files).where(eq(files.key, key));
  if (!row) throw missing();
  let allowed = row.ownerId === userId;
  if (!allowed && row.purpose === 'kyc') throw missing();
  if (!allowed && row.purpose === 'addon_evidence') {
    const [quote] = await db.select({ id: addonQuotes.id }).from(addonQuotes).innerJoin(bookings, eq(bookings.id, addonQuotes.bookingId))
      .where(and(eq(addonQuotes.photoKey, key), or(eq(bookings.customerId, userId), eq(bookings.proId, userId)))).limit(1);
    allowed = !!quote;
  }
  if (!allowed) {
    const [message] = await db.select({ id: messages.id }).from(messages).innerJoin(bookings, eq(bookings.id, messages.bookingId))
      .where(and(eq(messages.photoKey, key), or(eq(bookings.customerId, userId), eq(bookings.proId, userId)))).limit(1);
    allowed = !!message;
  }
  if (!allowed && row.purpose === 'request_photo') {
    const [request] = await db.select({ id: bulletinRequests.id }).from(bulletinRequests).where(eq(bulletinRequests.photoKey, key)).limit(1);
    allowed = !!request;
  }
  if (!allowed && row.purpose === 'avatar') {
    const [pro] = await db.select({ id: users.id }).from(users).innerJoin(proProfiles, eq(proProfiles.userId, users.id))
      .where(and(eq(users.avatarKey, key), eq(users.isActive, true), eq(proProfiles.kycStatus, 'APPROVED'))).limit(1);
    allowed = !!pro;
  }
  if (!allowed && row.purpose === 'avatar') {
    const [peer] = await db.select({ id: users.id }).from(users).innerJoin(bookings,
      or(and(eq(bookings.customerId, users.id), eq(bookings.proId, userId)), and(eq(bookings.proId, users.id), eq(bookings.customerId, userId))))
      .where(and(eq(users.id, row.ownerId), eq(users.avatarKey, key))).limit(1);
    allowed = !!peer;
  }
  if (!allowed || !(await c.env.UPLOADS.head(key))) throw missing();
  const downloadUrl = directUploadMode(c.env) ? await localUrl(new URL(c.req.url).origin + '/api/v1', c.env, row, 'GET', DOWNLOAD_TTL_SECONDS)
    : await getSignedUrl(s3(c.env), new GetObjectCommand({ Bucket: c.env.R2_BUCKET_NAME, Key: key }), { expiresIn: DOWNLOAD_TTL_SECONDS });
  return c.json({ key, downloadUrl, expiresInSeconds: DOWNLOAD_TTL_SECONDS });
});
