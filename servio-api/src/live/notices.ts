import type { notifications } from '../db/schema';

export type Notice = Omit<typeof notifications.$inferInsert, 'id' | 'readAt' | 'createdAt'>;
export interface BookingInfo { id: string; code: string | null; skuName: string; status: string; customerId: string; proId: string | null }
export type BookingChange =
  | { kind: 'created' } | { kind: 'status' } | { kind: 'addon-quote' } | { kind: 'addon-decision'; approved: boolean }
  | { kind: 'message'; body: string; photo: boolean } | { kind: 'review'; rating: number } | { kind: 'offer'; proId: string };

const label = (b: BookingInfo) => b.code ? `#${b.code}` : 'your booking';
const clip = (text: string, max = 120) => text.length > max ? `${text.slice(0, max - 1)}…` : text;

export function bookingNotices(b: BookingInfo, change: BookingChange, actorId: string | undefined): Notice[] {
  const customer = (n: Omit<Notice, 'userId' | 'bookingId'>): Notice => ({ ...n, userId: b.customerId, bookingId: b.id });
  const pro = (n: Omit<Notice, 'userId' | 'bookingId'>): Notice[] => b.proId ? [{ ...n, userId: b.proId, bookingId: b.id }] : [];
  const jobRoute = `/pro/order/${b.id}/execute`;
  const out: Notice[] = [];
  switch (change.kind) {
    case 'created':
      out.push(...pro({ kind: 'BOOKING', title: `New booking ${label(b)}`, body: `${b.skuName} — open the job to get started.`, route: jobRoute }));
      break;
    case 'offer':
      out.push({ kind: 'OFFER', title: 'New job request', body: `${b.skuName} nearby. Respond within 60 seconds.`, route: '/pro/radar-alert', userId: change.proId, bookingId: b.id });
      break;
    case 'status': {
      const toCustomer: Record<string, [string, string, string]> = {
        ACCEPTED: ['Pro found', `A Pro accepted ${b.skuName}.`, '/tabs/tracking'],
        EN_ROUTE: ['Your Pro is on the way', `Track ${label(b)} live.`, '/tabs/tracking'],
        ARRIVED: ['Your Pro has arrived', `${b.skuName} — meet your Pro.`, '/tabs/tracking'],
        IN_PROGRESS: ['Work has started', `${b.skuName} is in progress.`, '/tabs/tracking'],
        COMPLETED: ['Job completed', 'Rate your Pro and add a tip.', `/order/${b.id}/review`],
      };
      if (b.status === 'CANCELLED') {
        const body = `${b.skuName} was cancelled. Any mock escrow hold was settled per the cancellation policy.`;
        out.push(customer({ kind: 'BOOKING', title: `Booking ${label(b)} cancelled`, body, route: '/tabs/tracking' }));
        out.push(...pro({ kind: 'BOOKING', title: `Booking ${label(b)} cancelled`, body, route: '/pro' }));
      } else if (toCustomer[b.status]) {
        const [title, body, route] = toCustomer[b.status]!;
        out.push(customer({ kind: 'BOOKING', title, body, route }));
      }
      break;
    }
    case 'addon-quote':
      out.push(customer({ kind: 'ADDON', title: 'Add-on approval needed', body: `Your Pro requested an add-on for ${label(b)}.`, route: `/order/${b.id}/addon-modal` }));
      break;
    case 'addon-decision':
      out.push(...pro({ kind: 'ADDON', title: change.approved ? 'Add-on approved' : 'Add-on declined', body: `The customer ${change.approved ? 'approved' : 'declined'} your add-on for ${label(b)}.`, route: jobRoute }));
      break;
    case 'message': {
      const body = change.body.trim() ? clip(change.body.trim()) : change.photo ? 'Sent a photo.' : 'New message.';
      const route = `/order/${b.id}/chat`;
      if (actorId === b.customerId) out.push(...pro({ kind: 'MESSAGE', title: `Customer · ${label(b)}`, body, route }));
      else if (actorId === b.proId) out.push(customer({ kind: 'MESSAGE', title: `Your Pro · ${label(b)}`, body, route }));
      break;
    }
    case 'review':
      out.push(...pro({ kind: 'REVIEW', title: 'New review', body: `${'★'.repeat(change.rating)} for ${b.skuName}.`, route: '/pro/wallet' }));
      break;
  }
  return out.filter((n) => n.userId !== actorId);
}

export function bulletinNotices(request: { id: string; authorId: string; acceptedProId: string | null }, action: 'accept' | 'release' | 'cancel', actorId: string, previousProId?: string | null): Notice[] {
  const route = '/tabs/bulletin';
  const n = (userId: string | null | undefined, title: string, body: string): Notice[] => userId && userId !== actorId ? [{ userId, kind: 'BULLETIN', title, body, route, bookingId: null }] : [];
  if (action === 'accept') return n(request.authorId, 'A Pro accepted your request', 'Confirm the booking to choose your address and payment.');
  if (action === 'cancel') return n(previousProId, 'Request cancelled', 'The customer cancelled a request you reserved.');
  return [...n(request.authorId, 'Reservation released', 'Your request is open to other Pros again.'), ...n(previousProId, 'Reservation released', 'The customer released your reservation.')];
}
