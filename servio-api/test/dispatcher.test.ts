// event-armed Dispatcher DO and dispatch scheduling tests
import './setup';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { Hono } from 'hono';
import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { Client } from 'pg';
import type { Database } from '../src/db/client';
import { bookings, dispatchOffers, notifications } from '../src/db/schema';
import { FIRST_OFFER_WAIT_MS, OFFER_SECONDS } from '../src/dispatch/demo-dispatch';
import { Dispatcher } from '../src/dispatch/dispatcher';
import {
  clampDispatchTime,
  computeNextDispatchAt,
  DISPATCHER_NAME,
  MIN_DISPATCH_DELAY_MS,
  runScheduledDispatch,
} from '../src/dispatch/scheduled';
import type { AppEnv, Bindings, DispatchResult } from '../src/env';
import worker, { Dispatcher as ExportedDispatcher } from '../src/index';
import { notifyDispatch, notifyLive } from '../src/live/notify';

function createOrderRoomsSpy(failing = false) {
  const deliveries: { room: string; event: Record<string, unknown> }[] = [];
  const namespace = {
    getByName(name: string) {
      return {
        async fetch(_input: RequestInfo | URL, init?: RequestInit) {
          if (failing) throw new Error('OrderRoom unreachable');
          deliveries.push({
            room: name,
            event: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
          });
          return Response.json({ sent: true });
        },
      };
    },
  } as unknown as DurableObjectNamespace;
  return { namespace, deliveries };
}

function createDispatcherHarness(options: {
  runDispatch?: typeof runScheduledDispatch;
  now?: () => number;
  env?: Bindings;
} = {}) {
  let alarmAt: number | null = null;
  const setAlarmCalls: number[] = [];
  let getAlarmCalls = 0;
  let chain = Promise.resolve<unknown>(undefined);

  const ctx = {
    storage: {
      async getAlarm() {
        getAlarmCalls += 1;
        return alarmAt;
      },
      async setAlarm(scheduledTime: number | Date) {
        const ms = scheduledTime instanceof Date ? scheduledTime.getTime() : scheduledTime;
        alarmAt = ms;
        setAlarmCalls.push(ms);
      },
      async deleteAlarm() {
        alarmAt = null;
      },
    },
    blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> {
      const next = chain.then(fn, fn);
      chain = next.catch(() => undefined);
      return next;
    },
  } as unknown as DurableObjectState;

  const envRef = options.env ?? makeEnv();
  const instance = new Dispatcher(ctx, envRef, {
    runDispatch: options.runDispatch,
    now: options.now,
  });

  const namespace = {
    idFromName(name: string) {
      assert.equal(name, DISPATCHER_NAME);
      return name as unknown as DurableObjectId;
    },
    get() {
      return {
        fetch(input: RequestInfo | URL, init?: RequestInit) {
          const request = input instanceof Request ? input : new Request(String(input), init);
          return instance.fetch(request);
        },
      };
    },
  } as unknown as DurableObjectNamespace;

  const fireAlarm = async () => {
    alarmAt = null;
    await instance.alarm();
  };

  return {
    instance,
    namespace,
    fireAlarm,
    getAlarmAt: () => alarmAt,
    getSetAlarmCalls: () => [...setAlarmCalls],
    getAlarmReadCount: () => getAlarmCalls,
  };
}

function makeExecCtx() {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil(promise: Promise<unknown>) {
      pending.push(promise);
    },
    passThroughOnException() {},
  } as unknown as ExecutionContext;
  return {
    ctx,
    flush: async () => { await Promise.all(pending); },
  };
}

function makeEnv(overrides: Partial<Bindings> = {}): Bindings {
  const rooms = createOrderRoomsSpy();
  return {
    ENVIRONMENT: 'development',
    LAUNCH_CITY: 'tuguegarao',
    ALLOWED_ORIGINS: 'http://localhost:8100',
    R2_BUCKET_NAME: 'servio-uploads-dev',
    ORDER_ROOMS: rooms.namespace,
    GEOCODER: {} as DurableObjectNamespace,
    DISPATCHER: {} as DurableObjectNamespace,
    UPLOADS: {} as R2Bucket,
    ...overrides,
  };
}

function selectColumns(sqlText: string): string[] {
  const stripCol = (col: string) => col.trim().split('.').pop()!.replace(/^"|"$/g, '');
  const selectMatch = /^select\s+(.+?)\s+from\s+/i.exec(sqlText);
  if (selectMatch) {
    return selectMatch[1]!.split(',').map(stripCol);
  }
  const returningMatch = /\sreturning\s+(.+?)$/i.exec(sqlText);
  if (returningMatch) {
    return returningMatch[1]!.split(',').map(stripCol);
  }
  return [];
}

function toArrayRows(sqlText: string, rows: Record<string, unknown>[]): unknown[][] {
  const cols = selectColumns(sqlText);
  return rows.map((row) => cols.map((col) => row[col]));
}

interface StoredOffer {
  id: string;
  booking_id: string;
  pro_id: string;
  distance_m: number;
  expires_at: Date;
  response: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  responded_at: Date | null;
  created_at: Date;
}

function mockPgQueries(options: {
  nowMs: number;
  booking?: Record<string, unknown> | null;
  offers?: StoredOffer[];
  candidatePro?: { id: string; distanceM: number };
  heldCentavos?: number;
  actorUser?: { id: string; role: 'PRO' | 'CUSTOMER'; isDemo: boolean };
  proProfile?: { userId: string; kycStatus: 'APPROVED'; isOnline: boolean };
}) {
  const executedSql: string[] = [];
  let bookingStatus = options.booking ? String(options.booking.status) : null;
  let bookingEscrow = options.booking ? String(options.booking.escrow) : null;
  const offersState: StoredOffer[] = (options.offers ?? []).map((o) => ({ ...o }));
  const insertedOffers: unknown[][] = [];
  const insertedLedger: unknown[][] = [];
  const insertedNotifications: unknown[][] = [];
  let closed = false;

  mock.method(Client.prototype, 'connect', async () => undefined);
  mock.method(Client.prototype, 'end', async () => { closed = true; });
  mock.method(Client.prototype, 'query', async function (
    queryConfig: string | { text: string; rowMode?: string },
    params: unknown[] = [],
  ) {
    const text = typeof queryConfig === 'string' ? queryConfig : queryConfig.text;
    const rowMode = typeof queryConfig === 'string' ? undefined : queryConfig.rowMode;
    executedSql.push(text);

    if (/^(begin|commit|rollback)$/i.test(text.trim()) || /pg_advisory_xact_lock/i.test(text)) {
      return { rows: [] };
    }
    if (/clock_timestamp\(\)/i.test(text)) {
      return { rows: [{ nowMs: String(options.nowMs) }] };
    }
    if (/from\s+"sessions"/i.test(text)) {
      const user = options.actorUser ?? { id: '55555555-5555-4555-8555-555555555555', role: 'PRO', isDemo: false };
      const row = { user_id: user.id, id: '66666666-6666-4666-8666-666666666666', last_seen_at: new Date() };
      return { rows: rowMode === 'array' ? toArrayRows(text, [row]) : [row] };
    }
    if (/from\s+"users"\s+inner\s+join\s+"pro_profiles"/i.test(text)) {
      const user = options.actorUser ?? { id: '55555555-5555-4555-8555-555555555555', role: 'PRO', isDemo: false };
      const row = { id: user.id };
      return { rows: rowMode === 'array' ? toArrayRows(text, [row]) : [row] };
    }
    if (/from\s+"users"\s+where/i.test(text)) {
      const user = options.actorUser ?? { id: String(params[0] ?? 'pro-1'), role: 'PRO', isDemo: false };
      const row = {
        id: user.id,
        role: user.role,
        is_demo: user.isDemo,
        is_active: true,
      };
      return { rows: rowMode === 'array' ? toArrayRows(text, [row]) : [row] };
    }
    if (/from\s+"pro_profiles"/i.test(text)) {
      const profile = options.proProfile ?? { userId: 'pro-1', kycStatus: 'APPROVED', isOnline: true };
      const row = {
        user_id: profile.userId,
        kyc_status: profile.kycStatus,
        is_online: profile.isOnline,
      };
      return { rows: rowMode === 'array' ? toArrayRows(text, [row]) : [row] };
    }
    if (/from\s+"bookings"/i.test(text)) {
      if (!options.booking) return { rows: [] };
      const current = { ...options.booking, status: bookingStatus, escrow: bookingEscrow };
      // Held-booking queries filter by status/escrow; return [] once accepted/cancelled.
      if (/bookings"\."status"\s*=/i.test(text) && (bookingStatus !== 'PENDING_ACCEPTANCE' || bookingEscrow !== 'HOLD_AUTHORIZED')) {
        return { rows: [] };
      }
      return { rows: rowMode === 'array' ? toArrayRows(text, [current]) : [current] };
    }
    if (/from\s+"dispatch_offers"\s+inner\s+join\s+"bookings"/i.test(text)) {
      return { rows: [] };
    }
    if (/from\s+"dispatch_offers"/i.test(text)) {
      let matched = [...offersState];
      if (/response"\s*=\s*\$2/i.test(text) && params[1] === 'PENDING') {
        matched = matched.filter((o) => o.response === 'PENDING');
      }
      return { rows: rowMode === 'array' ? toArrayRows(text, matched as unknown as Record<string, unknown>[]) : matched };
    }
    if (/update\s+"dispatch_offers"/i.test(text)) {
      const response = String(params[0]) as StoredOffer['response'];
      const offerId = String(params[2]);
      for (const offer of offersState) {
        if (offer.id === offerId) {
          offer.response = response;
          offer.responded_at = new Date(options.nowMs);
        }
      }
      return { rows: [] };
    }
    if (/distance_km/i.test(text)) {
      return { rows: options.candidatePro ? [options.candidatePro] : [] };
    }
    if (/insert\s+into\s+"dispatch_offers"/i.test(text)) {
      insertedOffers.push(params);
      const id = '11111111-1111-4111-8111-111111111111';
      const created: StoredOffer = {
        id,
        booking_id: String(params[0]),
        pro_id: String(params[1]),
        distance_m: Number(params[2]),
        expires_at: new Date(String(params[3])),
        response: 'PENDING',
        responded_at: null,
        created_at: new Date(String(params[4] ?? options.nowMs)),
      };
      offersState.push(created);
      const row = { id };
      return { rows: rowMode === 'array' ? toArrayRows(text, [row]) : [row] };
    }
    if (/SUM\(amount_centavos\)/i.test(text)) {
      return { rows: [{ amount: String(options.heldCentavos ?? 115000) }] };
    }
    if (/insert\s+into\s+"ledger_entries"/i.test(text)) {
      insertedLedger.push(params);
      return { rows: [] };
    }
    if (/update\s+"bookings"/i.test(text)) {
      bookingStatus = 'CANCELLED';
      bookingEscrow = 'REFUNDED';
      return { rows: [] };
    }
    if (/insert\s+into\s+"notifications"/i.test(text)) {
      insertedNotifications.push(params);
      const row = {
        id: '22222222-2222-4222-8222-222222222222',
        user_id: params[0],
        kind: params[1],
        title: params[2],
        body: params[3],
        route: params[4],
        booking_id: params[5],
        read_at: null,
        created_at: new Date(options.nowMs),
      };
      return { rows: rowMode === 'array' ? toArrayRows(text, [row]) : [row] };
    }
    return { rows: [] };
  });

  return {
    executedSql,
    insertedOffers,
    insertedLedger,
    insertedNotifications,
    getStatus: () => ({ bookingStatus, bookingEscrow, closed, offers: [...offersState] }),
  };
}

function samplePendingBooking(createdAt: Date) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'SRV-8900',
    is_demo: false,
    idempotency_key: null,
    request_hash: null,
    customer_id: '44444444-4444-4444-8444-444444444444',
    pro_id: null,
    sku_id: 'sku-ac-leak',
    sku_name: 'AC Leak Repair',
    price_centavos: 110000,
    trust_fee_centavos: 5000,
    tip_centavos: 0,
    discount_centavos: 0,
    address: { street: 'Centro 10', barangay: 'Centro 10', city: 'Tuguegarao City' },
    lat: 17.613,
    lng: 121.727,
    schedule: 'ASAP',
    schedule_start_at: null,
    schedule_end_at: null,
    expected_arrival_at: null,
    no_show_deadline_at: null,
    payment_method: 'GCASH',
    status: 'PENDING_ACCEPTANCE',
    escrow: 'HOLD_AUTHORIZED',
    pin_attempts: 0,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

afterEach(() => {
  mock.restoreAll();
});

describe('computeNextDispatchAt and clampDispatchTime', () => {
  const nowMs = 1_794_800_000_000;

  it('returns null when no held bookings remain', () => {
    assert.equal(computeNextDispatchAt(nowMs, [], []), null);
  });

  it('returns the soonest pending offer expiry when at least 30 s away', () => {
    const next = computeNextDispatchAt(
      nowMs,
      [
        { id: 'b1', createdAt: new Date(nowMs - 10_000) },
        { id: 'b2', createdAt: new Date(nowMs - 20_000) },
      ],
      [
        { bookingId: 'b1', response: 'PENDING', expiresAt: new Date(nowMs + 90_000) },
        { bookingId: 'b2', response: 'PENDING', expiresAt: new Date(nowMs + OFFER_SECONDS * 1000) },
      ],
    );
    assert.equal(next, nowMs + OFFER_SECONDS * 1000);
  });

  it('enforces the 30 s floor when an offer expires sooner than 30 s', () => {
    const next = computeNextDispatchAt(
      nowMs,
      [{ id: 'b1', createdAt: new Date(nowMs - 50_000) }],
      [{ bookingId: 'b1', response: 'PENDING', expiresAt: new Date(nowMs + 8_000) }],
    );
    assert.equal(next, nowMs + MIN_DISPATCH_DELAY_MS);
  });

  it('uses retry interval or FIRST_OFFER_WAIT_MS deadline for unoffered held bookings', () => {
    const freshRetry = computeNextDispatchAt(
      nowMs,
      [{ id: 'b1', createdAt: new Date(nowMs - 20_000) }],
      [],
    );
    assert.equal(freshRetry, nowMs + OFFER_SECONDS * 1000);

    // Near the 5-minute cutoff (45 s left < 60 s retry), picks the 45 s deadline.
    const nearDeadline = computeNextDispatchAt(
      nowMs,
      [{ id: 'b1', createdAt: new Date(nowMs - (FIRST_OFFER_WAIT_MS - 45_000)) }],
      [],
    );
    assert.equal(nearDeadline, nowMs + 45_000);

    // With 10 s left in the 5-minute window, clamps up to the 30 s floor.
    const flooredDeadline = computeNextDispatchAt(
      nowMs,
      [{ id: 'b1', createdAt: new Date(nowMs - (FIRST_OFFER_WAIT_MS - 10_000)) }],
      [],
    );
    assert.equal(flooredDeadline, nowMs + MIN_DISPATCH_DELAY_MS);
  });

  it('floors expired-only held bookings and invalid inputs to 30 s', () => {
    const next = computeNextDispatchAt(
      nowMs,
      [{ id: 'b1', createdAt: new Date(nowMs - 120_000) }],
      [{ bookingId: 'b1', response: 'EXPIRED', expiresAt: new Date(nowMs - 5_000) }],
    );
    assert.equal(next, nowMs + MIN_DISPATCH_DELAY_MS);
    assert.equal(clampDispatchTime(undefined, nowMs), nowMs + MIN_DISPATCH_DELAY_MS);
    assert.equal(clampDispatchTime(Number.NaN, nowMs), nowMs + MIN_DISPATCH_DELAY_MS);
  });
});

describe('Dispatcher Durable Object', () => {
  const nowMs = 1_794_800_000_000;

  it('arms idempotently so two arms do not overwrite an earlier alarm or create two loops', async () => {
    const harness = createDispatcherHarness({ now: () => nowMs });

    const firstRes = await harness.instance.fetch(new Request('http://dispatcher/arm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));
    assert.deepEqual(await firstRes.json(), { armed: true, alarmAt: nowMs + MIN_DISPATCH_DELAY_MS });

    // Second arm for a later timestamp leaves the existing sooner alarm untouched.
    const secondRes = await harness.instance.fetch(new Request('http://dispatcher/arm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atMs: nowMs + 90_000 }),
    }));
    assert.deepEqual(await secondRes.json(), { armed: false, alarmAt: nowMs + MIN_DISPATCH_DELAY_MS });
    assert.deepEqual(harness.getSetAlarmCalls(), [nowMs + MIN_DISPATCH_DELAY_MS]);

    // Concurrent arms serialize cleanly without setting twice.
    const third = createDispatcherHarness({ now: () => nowMs });
    const [a, b] = await Promise.all([
      third.instance.arm(nowMs + 60_000),
      third.instance.arm(nowMs + 75_000),
    ]);
    assert.deepEqual(a, { armed: true, alarmAt: nowMs + 60_000 });
    assert.deepEqual(b, { armed: false, alarmAt: nowMs + 60_000 });
    assert.deepEqual(third.getSetAlarmCalls(), [nowMs + 60_000]);

    // An arm strictly earlier than an existing distant alarm pulls the single alarm earlier.
    const earlier = await third.instance.arm(nowMs + MIN_DISPATCH_DELAY_MS);
    assert.deepEqual(earlier, { armed: true, alarmAt: nowMs + MIN_DISPATCH_DELAY_MS });
    assert.deepEqual(third.getSetAlarmCalls(), [nowMs + 60_000, nowMs + MIN_DISPATCH_DELAY_MS]);
  });

  it('re-arms when held bookings remain and stays off when idle', async () => {
    let nextAt: number | null = nowMs + 60_000;
    const harness = createDispatcherHarness({
      now: () => nowMs,
      runDispatch: async () => ({
        dispatch: { offered: [], cancelled: [] },
        nextAt,
      }),
    });

    await harness.instance.arm();
    assert.equal(harness.getAlarmAt(), nowMs + MIN_DISPATCH_DELAY_MS);

    // First alarm finds work remaining -> re-arms for nextAt.
    await harness.fireAlarm();
    assert.equal(harness.getAlarmAt(), nowMs + 60_000);

    // Second alarm finishes all work -> nextAt is null, does not re-arm, stays off.
    nextAt = null;
    await harness.fireAlarm();
    assert.equal(harness.getAlarmAt(), null);
    assert.deepEqual(harness.getSetAlarmCalls(), [nowMs + MIN_DISPATCH_DELAY_MS, nowMs + 60_000]);
  });

  it('preserves a concurrent arm triggered while alarm() is running', async () => {
    let harness!: ReturnType<typeof createDispatcherHarness>;
    harness = createDispatcherHarness({
      now: () => nowMs,
      runDispatch: async () => {
        // Simulate POST /bookings arming at +30s while alarm() is mid-execution.
        await harness.instance.arm(nowMs + MIN_DISPATCH_DELAY_MS);
        return { dispatch: { offered: [], cancelled: [] }, nextAt: null };
      },
    });

    await harness.fireAlarm();
    assert.equal(harness.getAlarmAt(), nowMs + MIN_DISPATCH_DELAY_MS);
  });

  it('rejects unknown DO routes with 404', async () => {
    const harness = createDispatcherHarness({ now: () => nowMs });
    const res = await harness.instance.fetch(new Request('http://dispatcher/unknown', { method: 'GET' }));
    assert.equal(res.status, 404);
  });
});

describe('runScheduledDispatch and notifyDispatch', () => {
  it('skips cleanly without invoking dispatch when database is unconfigured', async () => {
    const warnCalls: string[] = [];
    mock.method(console, 'warn', (msg: unknown) => { warnCalls.push(String(msg)); });
    let ticked = false;
    let notified = false;

    const result = await runScheduledDispatch(makeEnv(), {
      connectDb: async () => null,
      dispatchTick: async () => { ticked = true; return { offered: [], cancelled: [] }; },
      notifyDispatch: async () => { notified = true; },
    });

    assert.deepEqual(result, { dispatch: { offered: [], cancelled: [] }, nextAt: null });
    assert.equal(ticked, false);
    assert.equal(notified, false);
    assert.equal(JSON.parse(warnCalls[0]!).code, 'DISPATCH_ALARM_SKIPPED');
  });

  it('reuses dispatchTick, emits notifications, and computes nextAt before closing db', async () => {
    const events: string[] = [];
    const fakeDb = {} as Database;
    const expectedDispatch: DispatchResult = {
      offered: [{ offerId: 'offer-1', bookingId: 'booking-1', proId: 'pro-1' }],
      cancelled: ['booking-2'],
    };
    const env = makeEnv({ LAUNCH_CITY: 'tuguegarao' });

    const result = await runScheduledDispatch(env, {
      connectDb: async () => ({
        db: fakeDb,
        source: 'direct',
        close: async () => { events.push('close'); },
      }),
      dispatchTick: async (...args) => {
        events.push('tick');
        assert.equal(args[0], fakeDb);
        assert.equal(args[1], 'tuguegarao');
        assert.equal(args[2], undefined);
        return expectedDispatch;
      },
      notifyDispatch: async (notifyEnv, notifyDb, dispatch) => {
        events.push('notify');
        assert.equal(notifyEnv, env);
        assert.equal(notifyDb, fakeDb);
        assert.deepEqual(dispatch, expectedDispatch);
      },
      nextDispatchAt: async (db) => {
        events.push('next');
        assert.equal(db, fakeDb);
        return 1_794_800_060_000;
      },
    });

    assert.deepEqual(result, { dispatch: expectedDispatch, nextAt: 1_794_800_060_000 });
    assert.deepEqual(events, ['tick', 'notify', 'next', 'close']);
  });

  it('always closes database connection and logs structured error on failure', async () => {
    const errorCalls: string[] = [];
    mock.method(console, 'error', (msg: unknown) => { errorCalls.push(String(msg)); });
    let closed = false;

    await assert.rejects(
      () => runScheduledDispatch(makeEnv(), {
        connectDb: async () => ({
          db: {} as Database,
          source: 'direct',
          close: async () => { closed = true; },
        }),
        dispatchTick: async () => { throw new Error('escrow check failed'); },
      }),
      /escrow check failed/,
    );

    assert.equal(closed, true);
    assert.equal(JSON.parse(errorCalls[0]!).code, 'DISPATCH_ALARM_FAILED');
    assert.equal(JSON.parse(errorCalls[0]!).message, 'escrow check failed');
  });

  it('delivers OrderRoom updates and inbox notices for offers and cancellations', async () => {
    const rooms = createOrderRoomsSpy();
    const dialect = new PgDialect();
    const insertedNotices: unknown[] = [];
    const bookingRows: Record<string, { id: string; code: string | null; skuName: string; status: string; customerId: string; proId: string | null }> = {
      'b-offer': { id: 'b-offer', code: 'SRV-9001', skuName: 'AC Cleaning', status: 'PENDING_ACCEPTANCE', customerId: 'cust-1', proId: null },
      'b-cancel': { id: 'b-cancel', code: 'SRV-9002', skuName: 'Pipe Repair', status: 'CANCELLED', customerId: 'cust-2', proId: null },
    };

    const fakeDb = {
      select() {
        let tableRef: unknown;
        return {
          from(table: unknown) {
            tableRef = table;
            return {
              async where(condition: unknown) {
                const { params } = dialect.sqlToQuery(condition as SQL);
                const id = params.find((p): p is string => typeof p === 'string' && p in bookingRows);
                if (tableRef === bookings) return id && bookingRows[id] ? [bookingRows[id]] : [];
                if (tableRef === dispatchOffers) return id === 'b-offer' ? [{ proId: 'pro-1' }] : [];
                return [];
              },
            };
          },
        };
      },
      insert(table: unknown) {
        assert.equal(table, notifications);
        return {
          values(rows: unknown[]) {
            insertedNotices.push(...rows);
            return { async returning() { return rows; } };
          },
        };
      },
    } as unknown as Database;

    await notifyDispatch(makeEnv({ ORDER_ROOMS: rooms.namespace }), fakeDb, {
      offered: [{ offerId: 'offer-1', bookingId: 'b-offer', proId: 'pro-1' }],
      cancelled: ['b-cancel'],
    });

    assert.equal(insertedNotices.length, 2);
    assert.deepEqual(rooms.deliveries, [
      { room: 'pro:pro-1', event: { type: 'dispatch', eventId: 'offer-1' } },
      { room: 'user:cust-1', event: { type: 'booking', bookingId: 'b-offer', change: 'status' } },
      { room: 'pro:pro-1', event: { type: 'dispatch' } },
      { room: 'booking:b-cancel', event: { type: 'status', bookingId: 'b-cancel' } },
      { room: 'user:cust-2', event: { type: 'booking', bookingId: 'b-cancel', change: 'status' } },
      { room: 'user:pro-1', event: { type: 'notification' } },
      { room: 'user:cust-2', event: { type: 'notification' } },
    ]);
  });
});

describe('HTTP arming and end-to-end Dispatcher alarm lifecycle', () => {
  const nowMs = 1_794_800_000_000;

  it('arms Dispatcher on held booking creation, stays idempotent on duplicate arm, and skips direct ACCEPTED bookings', async () => {
    const rooms = createOrderRoomsSpy();
    const harness = createDispatcherHarness({ now: () => nowMs });
    mockPgQueries({
      nowMs,
      booking: samplePendingBooking(new Date(nowMs)),
    });

    let createdStatus: 'PENDING_ACCEPTANCE' | 'ACCEPTED' = 'PENDING_ACCEPTANCE';
    const mini = new Hono<AppEnv>();
    mini.use('*', notifyLive);
    mini.post('/bookings', (c) => {
      c.set('userId', '44444444-4444-4444-8444-444444444444');
      return c.json({
        booking: {
          id: '33333333-3333-4333-8333-333333333333',
          status: createdStatus,
          skuId: 'sku-ac-leak',
          isDemo: false,
        },
      }, 201);
    });

    const env = makeEnv({
      DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/servio_test',
      ORDER_ROOMS: rooms.namespace,
      DISPATCHER: harness.namespace,
    });

    // Direct ACCEPTED booking must not arm Dispatcher.
    createdStatus = 'ACCEPTED';
    const directRes = await mini.request('/bookings', { method: 'POST' }, env);
    assert.equal(directRes.status, 201);
    assert.equal(harness.getAlarmAt(), null);
    assert.equal(harness.getSetAlarmCalls().length, 0);

    // Held PENDING_ACCEPTANCE booking arms Dispatcher once.
    createdStatus = 'PENDING_ACCEPTANCE';
    const heldRes = await mini.request('/bookings', { method: 'POST' }, env);
    assert.equal(heldRes.status, 201);
    assert.equal(harness.getAlarmAt(), nowMs + MIN_DISPATCH_DELAY_MS);
    assert.deepEqual(harness.getSetAlarmCalls(), [nowMs + MIN_DISPATCH_DELAY_MS]);

    // Second held booking right away is idempotent (no second loop, setAlarm not called again).
    const secondHeldRes = await mini.request('/bookings', { method: 'POST' }, env);
    assert.equal(secondHeldRes.status, 201);
    assert.deepEqual(harness.getSetAlarmCalls(), [nowMs + MIN_DISPATCH_DELAY_MS]);
  });

  it('arms Dispatcher via real POST /pro/dispatch, decline (200), and expired accept (409), and skips when idle', async () => {
    const rooms = createOrderRoomsSpy();
    const authHeaders = {
      Authorization: 'Bearer valid_test_token_1234567890',
      'Content-Type': 'application/json',
    };

    // Case 1: idle database -> POST /pro/dispatch does not arm Dispatcher.
    mock.method(console, 'log', () => {});
    const idleHarness = createDispatcherHarness({ now: () => nowMs });
    mockPgQueries({
      nowMs,
      booking: null,
      actorUser: { id: '55555555-5555-4555-8555-555555555555', role: 'PRO', isDemo: false },
    });

    const idleEnv = makeEnv({
      DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/servio_test',
      ORDER_ROOMS: rooms.namespace,
      DISPATCHER: idleHarness.namespace,
    });
    const idleExec = makeExecCtx();
    const idleRes = await worker.fetch(
      new Request('http://servio.test/api/v1/pro/dispatch', { method: 'POST', headers: authHeaders, body: '{}' }),
      idleEnv,
      idleExec.ctx,
    );
    await idleExec.flush();
    assert.equal(idleRes.status, 200);
    assert.equal(idleHarness.getAlarmAt(), null);
    assert.equal(idleHarness.getSetAlarmCalls().length, 0);

    mock.restoreAll();
    mock.method(console, 'log', () => {});

    // Case 2: held booking left waiting -> POST /pro/dispatch arms Dispatcher for next retry.
    const activeHarness = createDispatcherHarness({ now: () => nowMs });
    mockPgQueries({
      nowMs,
      booking: samplePendingBooking(new Date(nowMs - 20_000)),
      actorUser: { id: '55555555-5555-4555-8555-555555555555', role: 'PRO', isDemo: false },
    });
    const activeEnv = makeEnv({
      DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/servio_test',
      ORDER_ROOMS: rooms.namespace,
      DISPATCHER: activeHarness.namespace,
    });
    const activeExec = makeExecCtx();
    const activeRes = await worker.fetch(
      new Request('http://servio.test/api/v1/pro/dispatch', { method: 'POST', headers: authHeaders, body: '{}' }),
      activeEnv,
      activeExec.ctx,
    );
    await activeExec.flush();
    assert.equal(activeRes.status, 200);
    assert.equal(activeHarness.getAlarmAt(), nowMs + OFFER_SECONDS * 1000);
    assert.deepEqual(activeHarness.getSetAlarmCalls(), [nowMs + OFFER_SECONDS * 1000]);

    mock.restoreAll();
    mock.method(console, 'log', () => {});

    // Case 3: POST /offers/:id/decline (200) advances to next Pro and arms Dispatcher.
    const declineHarness = createDispatcherHarness({ now: () => nowMs });
    const pendingOffer: StoredOffer = {
      id: '99999999-9999-4999-8999-999999999999',
      booking_id: '33333333-3333-4333-8333-333333333333',
      pro_id: '55555555-5555-4555-8555-555555555555',
      distance_m: 300,
      expires_at: new Date(nowMs + 30_000),
      response: 'PENDING',
      responded_at: null,
      created_at: new Date(nowMs - 30_000),
    };
    mockPgQueries({
      nowMs,
      booking: samplePendingBooking(new Date(nowMs - 30_000)),
      offers: [pendingOffer],
      candidatePro: { id: '66666666-6666-4666-8666-666666666666', distanceM: 550 },
      actorUser: { id: '55555555-5555-4555-8555-555555555555', role: 'PRO', isDemo: false },
    });
    const declineEnv = makeEnv({
      DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/servio_test',
      ORDER_ROOMS: rooms.namespace,
      DISPATCHER: declineHarness.namespace,
    });
    const declineExec = makeExecCtx();
    const declineRes = await worker.fetch(
      new Request(`http://servio.test/api/v1/offers/${pendingOffer.id}/decline`, { method: 'POST', headers: authHeaders, body: '{}' }),
      declineEnv,
      declineExec.ctx,
    );
    await declineExec.flush();
    assert.equal(declineRes.status, 200);
    assert.equal(declineHarness.getAlarmAt(), nowMs + OFFER_SECONDS * 1000);

    mock.restoreAll();
    mock.method(console, 'log', () => {});

    // Case 4: POST /offers/:id/accept on expired offer (409) advances and arms Dispatcher.
    const expiredHarness = createDispatcherHarness({ now: () => nowMs });
    const expiredOffer: StoredOffer = {
      ...pendingOffer,
      response: 'PENDING',
      expires_at: new Date(nowMs - 1000),
      created_at: new Date(nowMs - 61_000),
    };
    mockPgQueries({
      nowMs,
      booking: samplePendingBooking(new Date(nowMs - 61_000)),
      offers: [expiredOffer],
      candidatePro: { id: '66666666-6666-4666-8666-666666666666', distanceM: 550 },
      actorUser: { id: '55555555-5555-4555-8555-555555555555', role: 'PRO', isDemo: false },
    });
    const expiredEnv = makeEnv({
      DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/servio_test',
      ORDER_ROOMS: rooms.namespace,
      DISPATCHER: expiredHarness.namespace,
    });
    const expiredExec = makeExecCtx();
    const expiredRes = await worker.fetch(
      new Request(`http://servio.test/api/v1/offers/${expiredOffer.id}/accept`, { method: 'POST', headers: authHeaders, body: '{}' }),
      expiredEnv,
      expiredExec.ctx,
    );
    await expiredExec.flush();
    assert.equal(expiredRes.status, 409);
    const expiredBody = await expiredRes.json() as { error: { code: string } };
    assert.equal(expiredBody.error.code, 'OFFER_EXPIRED');
    assert.equal(expiredHarness.getAlarmAt(), nowMs + OFFER_SECONDS * 1000);
  });

  it('offers booking and re-arms on alarm(), then cancels/refunds after timeout and stays off', async () => {
    const rooms = createOrderRoomsSpy();
    const offerDb = mockPgQueries({
      nowMs,
      booking: samplePendingBooking(new Date(nowMs - 30_000)),
      candidatePro: { id: '55555555-5555-4555-8555-555555555555', distanceM: 420 },
    });

    const offerEnv = makeEnv({
      DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/servio_test',
      ORDER_ROOMS: rooms.namespace,
    });
    const offerHarness = createDispatcherHarness({ now: () => nowMs, env: offerEnv });
    await offerHarness.instance.arm();
    await offerHarness.fireAlarm();

    assert.equal(offerDb.insertedOffers.length, 1);
    assert.equal(offerDb.getStatus().closed, true);
    assert.equal(offerHarness.getAlarmAt(), nowMs + OFFER_SECONDS * 1000);
    assert.deepEqual(rooms.deliveries, [
      { room: 'pro:55555555-5555-4555-8555-555555555555', event: { type: 'dispatch', eventId: '11111111-1111-4111-8111-111111111111' } },
      { room: 'user:44444444-4444-4444-8444-444444444444', event: { type: 'booking', bookingId: '33333333-3333-4333-8333-333333333333', change: 'status' } },
      { room: 'pro:55555555-5555-4555-8555-555555555555', event: { type: 'dispatch' } },
      { room: 'user:55555555-5555-4555-8555-555555555555', event: { type: 'notification' } },
    ]);

    mock.restoreAll();
    const cancelRooms = createOrderRoomsSpy();
    const cancelDb = mockPgQueries({
      nowMs,
      booking: samplePendingBooking(new Date(nowMs - FIRST_OFFER_WAIT_MS - 1000)),
      heldCentavos: 115000,
    });
    const cancelEnv = makeEnv({
      DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/servio_test',
      ORDER_ROOMS: cancelRooms.namespace,
    });
    const cancelHarness = createDispatcherHarness({ now: () => nowMs, env: cancelEnv });
    await cancelHarness.instance.arm();
    await cancelHarness.fireAlarm();

    assert.equal(cancelDb.getStatus().bookingStatus, 'CANCELLED');
    assert.equal(cancelDb.getStatus().bookingEscrow, 'REFUNDED');
    assert.equal(cancelDb.getStatus().closed, true);
    assert.equal(cancelHarness.getAlarmAt(), null);
    const ledgerAmounts = cancelDb.insertedLedger[0]!.filter((v): v is number => typeof v === 'number');
    assert.deepEqual(ledgerAmounts, [-115000, 115000]);
    assert.deepEqual(cancelRooms.deliveries, [
      { room: 'booking:33333333-3333-4333-8333-333333333333', event: { type: 'status', bookingId: '33333333-3333-4333-8333-333333333333' } },
      { room: 'user:44444444-4444-4444-8444-444444444444', event: { type: 'booking', bookingId: '33333333-3333-4333-8333-333333333333', change: 'status' } },
      { room: 'user:44444444-4444-4444-8444-444444444444', event: { type: 'notification' } },
    ]);
  });

  it('exports Dispatcher and Worker fetch handler without scheduled() in src/index.ts', async () => {
    mock.method(console, 'log', () => {});
    assert.equal(ExportedDispatcher, Dispatcher);
    assert.equal('scheduled' in worker, false);
    const res = await worker.fetch(new Request('http://servio.test/api/v1/health'), makeEnv(), {
      waitUntil() {},
      passThroughOnException() {},
    } as unknown as ExecutionContext);
    assert.equal(res.status, 503);
  });
});
