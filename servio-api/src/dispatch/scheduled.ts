// scheduled dispatch runner and alarm timing
import { and, asc, eq, inArray } from 'drizzle-orm';
import { connectDb, type Database, type Executor } from '../db/client';
import { bookings, dispatchOffers } from '../db/schema';
import type { Bindings, DispatchResult } from '../env';
import { serverNow } from '../lib/bookings';
import { notifyDispatch } from '../live/notify';
import { dispatchTick, emptyDispatch, FIRST_OFFER_WAIT_MS, OFFER_SECONDS } from './demo-dispatch';

export const MIN_DISPATCH_DELAY_MS = 30_000;
export const DISPATCHER_NAME = 'servio-global-dispatcher';

export interface ScheduledDispatchDeps {
  connectDb?: typeof connectDb;
  dispatchTick?: typeof dispatchTick;
  notifyDispatch?: typeof notifyDispatch;
  nextDispatchAt?: (db: Database) => Promise<number | null>;
}

export interface ScheduledDispatchResult {
  dispatch: DispatchResult;
  nextAt: number | null;
}

/** Clamps a target dispatch timestamp to at least MIN_DISPATCH_DELAY_MS from now. */
export function clampDispatchTime(atMs: number | undefined, nowMs: number): number {
  const floor = nowMs + MIN_DISPATCH_DELAY_MS;
  if (atMs === undefined || !Number.isFinite(atMs)) return floor;
  return Math.max(floor, Math.trunc(atMs));
}

/** Computes the soonest timestamp when any held booking can advance, or null when idle. */
export function computeNextDispatchAt(
  nowMs: number,
  held: { id: string; createdAt: Date }[],
  offers: { bookingId: string; response: string; expiresAt: Date }[],
): number | null {
  if (!held.length) return null;
  let soonest = Infinity;
  for (const booking of held) {
    const bookingOffers = offers.filter((o) => o.bookingId === booking.id);
    const activePending = bookingOffers
      .filter((o) => o.response === 'PENDING' && o.expiresAt.getTime() > nowMs)
      .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())[0];
    if (activePending) {
      soonest = Math.min(soonest, activePending.expiresAt.getTime());
    } else if (bookingOffers.length === 0) {
      const waitDeadline = booking.createdAt.getTime() + FIRST_OFFER_WAIT_MS;
      const retryAt = nowMs + OFFER_SECONDS * 1000;
      soonest = Math.min(soonest, Math.min(waitDeadline, retryAt));
    } else {
      soonest = Math.min(soonest, nowMs);
    }
  }
  return clampDispatchTime(soonest, nowMs);
}

/** Queries held bookings and pending offers to determine the next Dispatcher alarm time. */
export async function nextDispatchAt(db: Database, getNow: (db: Executor) => Promise<Date> = serverNow): Promise<number | null> {
  const held = await db
    .select({ id: bookings.id, createdAt: bookings.createdAt })
    .from(bookings)
    .where(and(eq(bookings.status, 'PENDING_ACCEPTANCE'), eq(bookings.escrow, 'HOLD_AUTHORIZED')))
    .orderBy(asc(bookings.createdAt))
    .limit(100);
  if (!held.length) return null;
  const offers = await db
    .select({
      bookingId: dispatchOffers.bookingId,
      response: dispatchOffers.response,
      expiresAt: dispatchOffers.expiresAt,
    })
    .from(dispatchOffers)
    .where(inArray(dispatchOffers.bookingId, held.map((b) => b.id)));
  const now = await getNow(db);
  return computeNextDispatchAt(now.getTime(), held, offers);
}

/** Arms the singleton Dispatcher Durable Object alarm if DISPATCHER is configured. */
export async function armDispatcher(env: Pick<Bindings, 'DISPATCHER'>, atMs?: number): Promise<void> {
  if (!env.DISPATCHER) return;
  const stub = env.DISPATCHER.get(env.DISPATCHER.idFromName(DISPATCHER_NAME));
  await stub.fetch('http://dispatcher/arm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(atMs === undefined ? {} : { atMs }),
  });
}

/** Runs one dispatch pass across all held bookings, emits live updates, and computes the next wakeup. */
export async function runScheduledDispatch(
  env: Bindings,
  deps: ScheduledDispatchDeps = {},
): Promise<ScheduledDispatchResult> {
  const openDb = deps.connectDb ?? connectDb;
  const tick = deps.dispatchTick ?? dispatchTick;
  const notify = deps.notifyDispatch ?? notifyDispatch;
  const computeNext = deps.nextDispatchAt ?? nextDispatchAt;

  let client: Awaited<ReturnType<typeof openDb>> = null;
  try {
    client = await openDb(env);
    if (!client) {
      console.warn(JSON.stringify({
        level: 'warn',
        code: 'DISPATCH_ALARM_SKIPPED',
        reason: 'DATABASE_UNCONFIGURED',
      }));
      return { dispatch: emptyDispatch(), nextAt: null };
    }
    const dispatch = await tick(client.db, env.LAUNCH_CITY);
    await notify(env, client.db, dispatch);
    const nextAt = await computeNext(client.db);
    return { dispatch, nextAt };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      code: 'DISPATCH_ALARM_FAILED',
      message: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  } finally {
    await client?.close();
  }
}
