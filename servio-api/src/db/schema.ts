// database schema
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

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

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

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    phoneNumber: text('phone_number'),
    fullName: text('full_name'),
    avatarKey: text('avatar_key'),
    role: userRole('role').notNull().default('CUSTOMER'),
    preferredPaymentMethod: text('preferred_payment_method').$type<'GCASH' | 'CARD'>().notNull().default('GCASH'),
    isActive: boolean('is_active').notNull().default(true),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    check('users_payment_method_chk', sql`${t.preferredPaymentMethod} IN ('GCASH','CARD')`),
    uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`),
    check('users_phone_ph_chk', sql`${t.phoneNumber} IS NULL OR ${t.phoneNumber} ~ '^\\+639[0-9]{9}$'`),
  ],
);

export const userAddresses = pgTable('user_addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  label: text('label').notNull(),
  street: text('street').notNull(),
  barangay: text('barangay').notNull(),
  city: text('city').notNull(),
  landmark: text('landmark'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [
  index('user_addresses_owner_idx').on(t.userId),
  uniqueIndex('user_addresses_default_uq').on(t.userId).where(sql`${t.isDefault}`),
  check('user_addresses_coordinates_chk', sql`${t.lat} BETWEEN -90 AND 90 AND ${t.lng} BETWEEN -180 AND 180`),
]);

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
    ratingSum: integer('rating_sum').notNull().default(0),
    jobsDone: integer('jobs_done').notNull().default(0),
    cancellationStrikes: integer('cancellation_strikes').notNull().default(0),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index('pro_profiles_dispatch_idx').on(t.kycStatus, t.isOnline)],
);

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  icon: text('icon').notNull(),
  sortOrder: smallint('sort_order').notNull().default(0),
});

export const serviceSkus = pgTable(
  'service_skus',
  {
    id: text('id').primaryKey(),
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
    discountCentavos: integer('discount_centavos').notNull().default(0),
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
    check('bookings_discount_chk', sql`${t.discountCentavos} >= 0 AND ${t.discountCentavos} < ${t.priceCentavos}`),
  ],
);

export const customerCoupons = pgTable(
  'customer_coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => users.id),
    milestone: smallint('milestone').notNull(),
    percentOff: smallint('percent_off').notNull(),
    maxDiscountCentavos: integer('max_discount_centavos').notNull(),
    status: text('status').$type<'AVAILABLE' | 'REDEEMED'>().notNull().default('AVAILABLE'),
    bookingId: uuid('booking_id').references(() => bookings.id),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex('customer_coupons_milestone_uq').on(t.customerId, t.milestone),
    index('customer_coupons_booking_idx').on(t.bookingId),
    check('customer_coupons_status_chk', sql`${t.status} IN ('AVAILABLE','REDEEMED')`),
    check('customer_coupons_redemption_chk', sql`(${t.status} = 'AVAILABLE') = (${t.bookingId} IS NULL)`),
    check('customer_coupons_amount_chk', sql`${t.percentOff} BETWEEN 1 AND 90 AND ${t.maxDiscountCentavos} > 0`),
  ],
);

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
    uniqueIndex('addon_quotes_one_pending_uq').on(t.bookingId).where(sql`${t.decision} = 'PENDING'`),
  ],
);

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
    photoKey: text('photo_key'),
    urgent: boolean('urgent').notNull().default(false),
    neighborhood: text('neighborhood').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    status: requestStatus('status').notNull().default('OPEN'),
    acceptedProId: uuid('accepted_pro_id').references(() => users.id),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    bookingId: uuid('booking_id').references(() => bookings.id),
    createdAt: created(),
  },
  (t) => [
    check('bulletin_description_len_chk', sql`char_length(${t.description}) <= 200`),
    index('bulletin_status_created_idx').on(t.status, t.createdAt),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
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

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    txnId: uuid('txn_id').notNull(),
    account: text('account').notNull(),
    amountCentavos: integer('amount_centavos').notNull(),
    bookingId: uuid('booking_id').references(() => bookings.id),
    kind: text('kind').notNull(),
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

export const uploads = pgTable('uploads', {
  key: text('key').primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  purpose: text('purpose').notNull().$type<'addon_evidence' | 'kyc' | 'request_photo' | 'avatar'>(),
  contentType: text('content_type').notNull(),
  contentLength: integer('content_length').notNull(),
  createdAt: created(),
}, (t) => [index('uploads_owner_idx').on(t.ownerId), check('uploads_length_chk', sql`${t.contentLength} > 0 AND ${t.contentLength} <= 10485760`)]);

export const supportRequests = pgTable('support_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  clientKey: uuid('client_key').notNull(),
  bookingId: uuid('booking_id').references(() => bookings.id),
  category: text('category').notNull(),
  message: text('message').notNull(),
  status: text('status').$type<'OPEN' | 'REVIEWING' | 'RESOLVED'>().notNull().default('OPEN'),
  createdAt: created(), updatedAt: updated(),
}, (t) => [
  uniqueIndex('support_requests_retry_uq').on(t.userId,t.clientKey),
  index('support_requests_owner_created_idx').on(t.userId,t.createdAt),
  check('support_requests_message_chk',sql`char_length(${t.message}) BETWEEN 10 AND 2000`),
  check('support_requests_category_chk',sql`${t.category} IN ('BOOKING','PAYMENT','SAFETY','ACCOUNT','OTHER')`),
  check('support_requests_status_chk',sql`${t.status} IN ('OPEN','REVIEWING','RESOLVED')`),
]);

export const NOTIFICATION_KINDS = ['BOOKING', 'MESSAGE', 'ADDON', 'OFFER', 'BULLETIN', 'REVIEW', 'REWARD'] as const;
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  kind: text('kind').$type<(typeof NOTIFICATION_KINDS)[number]>().notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  route: text('route'),
  bookingId: uuid('booking_id').references(() => bookings.id),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [
  index('notifications_owner_created_idx').on(t.userId, t.createdAt, t.id),
  index('notifications_owner_unread_idx').on(t.userId).where(sql`${t.readAt} IS NULL`),
  check('notifications_kind_chk', sql`${t.kind} IN ('BOOKING','MESSAGE','ADDON','OFFER','BULLETIN','REVIEW','REWARD')`),
  check('notifications_route_chk', sql`${t.route} IS NULL OR ${t.route} ~ '^/[A-Za-z0-9/_-]{0,200}$'`),
]);
