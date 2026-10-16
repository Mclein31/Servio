import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/*
 * SERVIO system of record (Neon Postgres).
 *
 * Conventions
 *  - Money is integer centavos (₱1,100.00 → 110000). Never floats.
 *  - Prices are snapshotted onto bookings/quotes: catalog edits never rewrite history.
 *  - No cascading deletes on money or order data; booking_events and ledger_entries are append-only.
 *  - ADR-001: only fixed catalog SKUs exist. There is deliberately no bid/offer table.
 *  - ADR-002: completion PINs are derived (HMAC of the booking id), never stored.
 */

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRole = pgEnum('user_role', ['CUSTOMER', 'PRO', 'ADMIN']);
export const kycStatus = pgEnum('kyc_status', ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED']);
export const priceUnit = pgEnum('price_unit', ['job', 'hr', 'errand', 'visit']);
export const bookingStatus = pgEnum('booking_status', [
  'PENDING_ACCEPTANCE',
  'ACCEPTED',
  'EN_ROUTE',
  'ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export const escrowState = pgEnum('escrow_state', ['NONE', 'HOLD_AUTHORIZED', 'COMPLETED', 'REFUNDED']);
export const paymentMethod = pgEnum('payment_method', ['GCASH', 'CARD']);
export const addonDecision = pgEnum('addon_decision', ['PENDING', 'APPROVED', 'DECLINED']);
export const offerResponse = pgEnum('offer_response', ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']);
export const requestStatus = pgEnum('request_status', ['OPEN', 'URGENT', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export const payoutStatus = pgEnum('payout_status', ['REQUESTED', 'PAID', 'FAILED']);

// ---------------------------------------------------------------------------
// Identity & sessions
// ---------------------------------------------------------------------------
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    phoneNumber: text('phone_number'),
    fullName: text('full_name'),
    avatarKey: text('avatar_key'),
    role: userRole('role').notNull().default('CUSTOMER'),
    isActive: boolean('is_active').notNull().default(true),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`),
    check('users_phone_ph_chk', sql`${t.phoneNumber} IS NULL OR ${t.phoneNumber} ~ '^\\+639[0-9]{9}$'`),
  ],
);

/** One row per emailed sign-in code. Only the hash is stored. */
export const loginCodes = pgTable(
  'login_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    ip: text('ip'),
    createdAt: created(),
  },
  (t) => [index('login_codes_email_created_idx').on(t.email, t.createdAt)],
);

/** Opaque bearer sessions, stored as SHA-256 of the token. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
    createdAt: created(),
  },
  (t) => [uniqueIndex('sessions_token_hash_uq').on(t.tokenHash), index('sessions_user_idx').on(t.userId)],
);

// ---------------------------------------------------------------------------
// Pros
// ---------------------------------------------------------------------------
export const proProfiles = pgTable(
  'pro_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id),
    headline: text('headline'),
    bio: text('bio'),
    credentials: text('credentials').array().notNull().default(sql`'{}'::text[]`),
    yearsExperience: smallint('years_experience').notNull().default(0),
    kycStatus: kycStatus('kyc_status').notNull().default('NOT_SUBMITTED'),
    isOnline: boolean('is_online').notNull().default(false),
    lastLat: doublePrecision('last_lat'),
    lastLng: doublePrecision('last_lng'),
    lastLocatedAt: timestamp('last_located_at', { withTimezone: true }),
    ratingAvg: numeric('rating_avg', { precision: 3, scale: 2 }).notNull().default('0'),
    ratingCount: integer('rating_count').notNull().default(0),
    jobsDone: integer('jobs_done').notNull().default(0),
    cancellationStrikes: integer('cancellation_strikes').notNull().default(0),
    createdAt: created(),
    updatedAt: updated(),
  },
  // Dispatch prefilter: approved, online Pros. Distance is computed in SQL (PostGIS on Neon later).
  (t) => [index('pro_profiles_dispatch_idx').on(t.kycStatus, t.isOnline)],
);

// ---------------------------------------------------------------------------
// Catalog (ADR-001: standardized SKUs)
// ---------------------------------------------------------------------------
export const categories = pgTable('categories', {
  id: text('id').primaryKey(), // 'tutoring' | 'repairs' | 'errands' | 'beauty' | 'tech'
  label: text('label').notNull(),
  icon: text('icon').notNull(),
  sortOrder: smallint('sort_order').notNull().default(0),
});

export const serviceSkus = pgTable(
  'service_skus',
  {
    id: text('id').primaryKey(), // stable slug, e.g. 'sku-ac-leak'
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
    name: text('name').notNull(),
    priceCentavos: integer('price_centavos').notNull(),
    unit: priceUnit('unit').notNull(),
    durationLabel: text('duration_label').notNull(),
    inclusions: jsonb('inclusions').$type<string[]>().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [check('service_skus_price_chk', sql`${t.priceCentavos} > 0`), index('service_skus_category_idx').on(t.categoryId)],
);

/** Approved add-on parts / extra labor (ADR-004). */
export const addonSkus = pgTable(
  'addon_skus',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    detail: text('detail').notNull(),
    priceCentavos: integer('price_centavos').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: created(),
  },
  (t) => [check('addon_skus_price_chk', sql`${t.priceCentavos} > 0`)],
);

/** Which catalog SKUs a Pro is qualified to perform. */
export const proSkus = pgTable(
  'pro_skus',
  {
    proId: uuid('pro_id')
      .notNull()
      .references(() => users.id),
    skuId: text('sku_id')
      .notNull()
      .references(() => serviceSkus.id),
  },
  (t) => [primaryKey({ columns: [t.proId, t.skuId] })],
);

// ---------------------------------------------------------------------------
// Bookings & escrow lifecycle (ADR-002)
// ---------------------------------------------------------------------------
export interface AddressSnapshot {
  street: string;
  barangay: string;
  city: string;
  landmark?: string;
}

export const bookingCodeSeq = pgSequence('booking_code_seq', { startWith: 8800, maxValue: 999999, cycle: false });

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Human-readable order code, e.g. SRV-8821. */
    code: text('code').notNull().default(sql`'SRV-' || nextval('booking_code_seq')::text`),
    isDemo: boolean('is_demo').notNull().default(false),
    idempotencyKey: text('idempotency_key'),
    requestHash: text('request_hash'),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    proId: uuid('pro_id').references(() => users.id),
    skuId: text('sku_id')
      .notNull()
      .references(() => serviceSkus.id),
    skuName: text('sku_name').notNull(),
    priceCentavos: integer('price_centavos').notNull(),
    trustFeeCentavos: integer('trust_fee_centavos').notNull(),
    tipCentavos: integer('tip_centavos').notNull().default(0),
    address: jsonb('address').$type<AddressSnapshot>().notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    schedule: text('schedule').notNull(),
    scheduleStartAt: timestamp('schedule_start_at', { withTimezone: true }),
    scheduleEndAt: timestamp('schedule_end_at', { withTimezone: true }),
    expectedArrivalAt: timestamp('expected_arrival_at', { withTimezone: true }),
    noShowDeadlineAt: timestamp('no_show_deadline_at', { withTimezone: true }),
    paymentMethod: paymentMethod('payment_method').notNull(),
    status: bookingStatus('status').notNull().default('PENDING_ACCEPTANCE'),
    escrow: escrowState('escrow').notNull().default('NONE'),
    pinAttempts: smallint('pin_attempts').notNull().default(0),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    uniqueIndex('bookings_code_uq').on(t.code),
    uniqueIndex('bookings_customer_idempotency_uq').on(t.customerId, t.idempotencyKey),
    index('bookings_customer_idx').on(t.customerId, t.createdAt),
    index('bookings_pro_idx').on(t.proId, t.status),
    check('bookings_money_chk', sql`${t.priceCentavos} > 0 AND ${t.trustFeeCentavos} >= 0 AND ${t.tipCentavos} >= 0`),
    check('bookings_schedule_window_chk', sql`(${t.scheduleStartAt} IS NULL AND ${t.scheduleEndAt} IS NULL) OR (${t.scheduleStartAt} IS NOT NULL AND ${t.scheduleEndAt} IS NOT NULL AND ${t.scheduleEndAt} > ${t.scheduleStartAt})`),
    check('bookings_pin_attempts_chk', sql`${t.pinAttempts} >= 0`),
  ],
);

/** Append-only status history (drives the stepper timestamps and the audit trail). */
export const bookingEvents = pgTable(
  'booking_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    status: bookingStatus('status').notNull(),
    actorId: uuid('actor_id').references(() => users.id),
    note: text('note'),
    createdAt: created(),
  },
  (t) => [index('booking_events_booking_idx').on(t.bookingId, t.createdAt)],
);

export const addonQuotes = pgTable(
  'addon_quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    addonSkuId: text('addon_sku_id')
      .notNull()
      .references(() => addonSkus.id),
    addonName: text('addon_name').notNull(),
    priceCentavos: integer('price_centavos').notNull(),
    /** R2 object key of the evidence photo. */
    photoKey: text('photo_key').notNull(),
    note: text('note').notNull(),
    decision: addonDecision('decision').notNull().default('PENDING'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    index('addon_quotes_booking_idx').on(t.bookingId),
    // At most one open quote per booking.
    uniqueIndex('addon_quotes_one_pending_uq').on(t.bookingId).where(sql`${t.decision} = 'PENDING'`),
  ],
);

/** The 60-second radar window offered to one Pro. */
export const dispatchOffers = pgTable(
  'dispatch_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    proId: uuid('pro_id')
      .notNull()
      .references(() => users.id),
    distanceM: integer('distance_m').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    response: offerResponse('response').notNull().default('PENDING'),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index('dispatch_offers_pro_idx').on(t.proId, t.response), index('dispatch_offers_booking_idx').on(t.bookingId)],
);

// ---------------------------------------------------------------------------
// Community bulletin (fixed SKUs only — no open-price listings)
// ---------------------------------------------------------------------------
export const bulletinRequests = pgTable(
  'bulletin_requests',
  {
    isDemo: boolean('is_demo').notNull().default(false),
    id: uuid('id').primaryKey().defaultRandom(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id),
    skuId: text('sku_id')
      .notNull()
      .references(() => serviceSkus.id),
    description: text('description').notNull(),
    urgent: boolean('urgent').notNull().default(false),
    neighborhood: text('neighborhood').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    status: requestStatus('status').notNull().default('OPEN'),
    createdAt: created(),
  },
  (t) => [
    check('bulletin_description_len_chk', sql`char_length(${t.description}) <= 200`),
    index('bulletin_status_created_idx').on(t.status, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Messaging & reviews (order-scoped only — no social features, SCOPE.md §3)
// ---------------------------------------------------------------------------
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    /** Null for system messages. */
    senderId: uuid('sender_id').references(() => users.id),
    body: text('body').notNull(),
    photoKey: text('photo_key'),
    createdAt: created(),
  },
  (t) => [index('messages_booking_idx').on(t.bookingId, t.createdAt), check('messages_body_len_chk', sql`char_length(${t.body}) <= 2000`)],
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => users.id),
    rating: smallint('rating').notNull(),
    compliments: text('compliments').array().notNull().default(sql`'{}'::text[]`),
    body: text('body'),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex('reviews_booking_author_uq').on(t.bookingId, t.authorId),
    check('reviews_rating_chk', sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

// ---------------------------------------------------------------------------
// Money: double-entry ledger + payouts
// ---------------------------------------------------------------------------
/**
 * Every money movement is a transaction of ≥2 entries that sum to zero.
 * Accounts: 'customer:<userId>', 'escrow:<bookingId>', 'pro_wallet:<userId>',
 * 'platform_revenue', 'payout_clearing'. Balances are SUM(amount) per account.
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    txnId: uuid('txn_id').notNull(),
    account: text('account').notNull(),
    amountCentavos: integer('amount_centavos').notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    kind: text('kind').notNull(), // ESCROW_HOLD | ADDON_HOLD | ESCROW_RELEASE | TIP | PAYOUT | REFUND
    memo: text('memo'),
    createdAt: created(),
  },
  (t) => [
    index('ledger_account_idx').on(t.account, t.createdAt),
    index('ledger_txn_idx').on(t.txnId),
    check('ledger_nonzero_chk', sql`${t.amountCentavos} <> 0`),
  ],
);

export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    proId: uuid('pro_id')
      .notNull()
      .references(() => users.id),
    amountCentavos: integer('amount_centavos').notNull(),
    feeCentavos: integer('fee_centavos').notNull(),
    destinationMasked: text('destination_masked').notNull(),
    status: payoutStatus('status').notNull().default('REQUESTED'),
    createdAt: created(),
  },
  (t) => [check('payouts_min_chk', sql`${t.amountCentavos} >= 50000`)],
);
