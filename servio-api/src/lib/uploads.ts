// upload helpers
import { and, eq } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { uploads } from '../db/schema';
import type { Bindings } from '../env';
import { ApiError } from './errors';

export const UPLOAD_KEY = /^uploads\/(addon_evidence|kyc|request_photo|avatar)\/\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|pdf)$/;
export const UPLOAD_TYPES = {
  'image/jpeg': { extension: 'jpg', max: 5 * 1024 * 1024 },
  'image/png': { extension: 'png', max: 5 * 1024 * 1024 },
  'application/pdf': { extension: 'pdf', max: 10 * 1024 * 1024 },
} as const;

export async function ownedUpload(db: Executor, env: Bindings, key: string, ownerId: string, purpose: typeof uploads.$inferSelect.purpose) {
  const [row] = await db.select().from(uploads).where(and(eq(uploads.key, key), eq(uploads.ownerId, ownerId), eq(uploads.purpose, purpose)));
  if (!row || !UPLOAD_KEY.test(key)) throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.');
  const object = await env.UPLOADS.head(key);
  if (!object || object.size !== row.contentLength || object.httpMetadata?.contentType !== row.contentType) {
    throw new ApiError(422, 'UPLOAD_INCOMPLETE', 'Upload the declared file before using it.');
  }
  return row;
}

export async function uploadSignature(secret: string | undefined, value: string): Promise<string> {
  if (!secret) throw new ApiError(503, 'STORAGE_UNCONFIGURED', 'Local uploads need PIN_SECRET.');
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0)); }
  catch { throw new ApiError(503, 'STORAGE_UNCONFIGURED', 'Local uploads need a base64 secret.'); }
  if (bytes.length < 32) throw new ApiError(503, 'STORAGE_UNCONFIGURED', 'Local uploads need a 32-byte secret.');
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`servio-upload:${value}`));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
