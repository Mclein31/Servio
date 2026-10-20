import { ApiError } from './errors';

export async function completionPin(secret: string | undefined, bookingId: string): Promise<string> {
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(secret ?? ''), (c) => c.charCodeAt(0)); }
  catch { throw new ApiError(503, 'PIN_UNCONFIGURED', 'Completion verification is unavailable.'); }
  if (bytes.length < 32) throw new ApiError(503, 'PIN_UNCONFIGURED', 'Completion verification is unavailable.');
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bookingId)));
  const hex = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
  return BigInt(`0x${hex}`).toString(10).padStart(4, '0').slice(0, 4);
}
