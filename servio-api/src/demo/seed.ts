import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { bookingEvents, bookings, bulletinRequests, ledgerEntries, messages, payouts, proProfiles, proSkus, reviews, serviceSkus, uploads, users } from '../db/schema';
import { serverNow } from '../lib/bookings';
import { splitPayout } from '../lib/money';
import { DEMO, demoId } from './guard';
import { DEMO_ADDRESS, DEMO_AUTHORS, DEMO_BULLETIN, DEMO_IMAGES, DEMO_LOCATIONS, DEMO_PROS } from './data';

/** Presentation baseline. Existing rows are left alone so seeding never resets an ongoing demo. */
export async function seedDemo(db: Database, imageLengths: Record<string, number>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('servio:demo-seed',0))`);
    const now = await serverNow(tx);
    const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000);
    const midnight = Math.floor((now.getTime() + 8 * 3600000) / 86400000) * 86400000 - 8 * 3600000;
    const today = (fraction: number) => new Date(midnight + Math.floor((now.getTime() - midnight) * fraction));
    const accounts = [
      { id: DEMO.customer, email: 'demo.customer@servio.test', fullName: 'Sophia M.', role: 'CUSTOMER' as const },
      ...DEMO_PROS.map((p) => ({ id: p.id, email: p.email, fullName: p.name, role: 'PRO' as const })),
      { id: DEMO.admin, email: 'demo.admin@servio.test', fullName: 'SERVIO Admin', role: 'ADMIN' as const },
      ...DEMO_AUTHORS.map((p) => ({ id: p.id, email: p.email, fullName: p.name, role: 'CUSTOMER' as const })),
    ];
    const existing = await tx.select().from(users).where(sql`lower(${users.email}) IN (${sql.join(accounts.map((a) => sql`${a.email}`), sql`,`)}) OR ${inArray(users.id, accounts.map((a) => a.id))}`);
    for (const row of existing) {
      const expected = accounts.find((a) => a.id === row.id);
      if (!expected || !row.isDemo || row.email.toLowerCase() !== expected.email || row.role !== expected.role) throw new Error('Demo identity conflicts with an existing account. No existing account was changed.');
    }
    await tx.insert(users).values(accounts.map((a) => ({ ...a, isDemo: true, avatarKey: DEMO_IMAGES.find((i) => i.ownerId === a.id && i.purpose === 'avatar')?.key }))).onConflictDoNothing();
    for (const p of DEMO_PROS) {
      const loc = DEMO_LOCATIONS[p.location];
      const ratingSum = Math.round(p.rating * p.count);
      await tx.insert(proProfiles).values({ userId: p.id, headline: p.headline, bio: p.bio, credentials: [...p.credentials], yearsExperience: p.years,
        kycStatus: 'APPROVED', isOnline: true, lastLat: loc.lat, lastLng: loc.lng, lastLocatedAt: now,
        ratingSum, ratingCount: p.count, ratingAvg: (ratingSum / p.count).toFixed(2), jobsDone: p.jobs }).onConflictDoNothing();
      await tx.insert(proSkus).values(p.skus.map((skuId) => ({ proId: p.id, skuId }))).onConflictDoNothing();
    }
    for (const image of DEMO_IMAGES) {
      const length = imageLengths[image.key];
      if (!Number.isInteger(length) || !length || length > 5 * 1024 * 1024) throw new Error('Upload every demo image before seeding metadata.');
      await tx.insert(uploads).values({ key: image.key, ownerId: image.ownerId, purpose: image.purpose, contentType: 'image/png', contentLength: length }).onConflictDoNothing();
    }
    const catalog = await tx.select().from(serviceSkus);
    const sku = (id: string) => { const row = catalog.find((s) => s.id === id && s.isActive); if (!row) throw new Error(`Missing catalog SKU ${id}; run db:seed first.`); return row; };
    const history = [
      { id: demoId(110), code: 'SRV-8807', customer: DEMO.customer, pro: DEMO.kevin, sku: 'sku-laptop-diag', at: ago(1440), tip: 0 },
      { id: demoId(111), code: 'SRV-8790', customer: DEMO.customer, pro: DEMO.daniel, sku: 'sku-sink-leak', at: ago(6 * 1440), tip: 0 },
      { id: demoId(112), code: 'SRV-8772', customer: DEMO.customer, pro: DEMO.ava, sku: 'sku-grocery', at: ago(10 * 1440), tip: 0 },
      { id: demoId(120), code: 'SRV-8820', customer: DEMO_AUTHORS[1]!.id, pro: DEMO.daniel, sku: 'sku-sink-leak', at: today(0.8), tip: 10000 },
      { id: demoId(121), code: 'SRV-8817', customer: DEMO_AUTHORS[5]!.id, pro: DEMO.daniel, sku: 'sku-ac-leak', at: today(0.6), tip: 0 },
      { id: demoId(122), code: 'SRV-8812', customer: DEMO_AUTHORS[0]!.id, pro: DEMO.daniel, sku: 'sku-elec-inspect', at: today(0.4), tip: 5000 },
    ];
    const all = [
      { id: DEMO.active, code: 'SRV-8821', customer: DEMO.customer, pro: DEMO.daniel, sku: 'sku-ac-leak', at: ago(1), tip: 0, status: 'EN_ROUTE' as const },
      // A queued, scheduled AC job supplies the other ₱935 pending; no fictitious SKU or price.
      { id: demoId(101), code: 'SRV-8819', customer: DEMO_AUTHORS[1]!.id, pro: DEMO.daniel, sku: 'sku-ac-leak', at: today(0.15), tip: 0, status: 'ACCEPTED' as const },
      ...history.map((h) => ({ ...h, status: 'COMPLETED' as const })),
    ];
    for (const b of all) {
      const [collision] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.code,b.code));
      if (collision && collision.id !== b.id) throw new Error(`Reserved demo code ${b.code} already belongs to another booking. Use a dedicated demo database/reset; no row was overwritten.`);
    }
    const [prior] = await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.id,DEMO.active));
    const entries: (typeof ledgerEntries.$inferInsert)[] = [];
    let serial = 0;
    const ledger = (kind: string, at: Date, bookingId: string | undefined, rows: [string,number][], memo?: string) => {
      const txnId = demoId(5000 + serial++);
      rows.filter(([,amount]) => amount !== 0).forEach(([account,amountCentavos],i) => entries.push({ id: demoId(10000 + serial * 10 + i), txnId, account, amountCentavos, kind, createdAt: at, bookingId, memo }));
    };
    for (const [i,b] of all.entries()) {
      const service = sku(b.sku); const fee = 5000; const total = service.priceCentavos + fee; const completed = b.status === 'COMPLETED';
      const scheduled = b.id === demoId(101);
      const scheduleStartAt = scheduled ? new Date(midnight + 86400000 + 3600000) : null; // Tomorrow 09:00 Philippine time.
      const scheduleEndAt = scheduled ? new Date(midnight + 86400000 + 4 * 3600000) : null;
      const createdAt = b.id === DEMO.active ? ago(11) : new Date(b.at.getTime() - 45 * 60000);
      await tx.insert(bookings).values({ id: b.id, code: b.code, isDemo: true, customerId: b.customer, proId: b.pro, skuId: service.id,
        skuName: service.name, priceCentavos: service.priceCentavos, trustFeeCentavos: fee, tipCentavos: b.tip, address: DEMO_ADDRESS,
        lat: 17.618111, lng: 121.718927, schedule: scheduled ? 'Tomorrow Morning' : 'ASAP', scheduleStartAt, scheduleEndAt,
        expectedArrivalAt: b.status === 'EN_ROUTE' ? new Date(b.at.getTime() + 30 * 60000) : scheduleEndAt,
        noShowDeadlineAt: b.status === 'EN_ROUTE' ? new Date(b.at.getTime() + 60 * 60000) : scheduleEndAt ? new Date(scheduleEndAt.getTime() + 30 * 60000) : null,
        paymentMethod: 'GCASH', status: b.status, escrow: completed ? 'COMPLETED' : 'HOLD_AUTHORIZED', createdAt }).onConflictDoNothing();
      const statuses = completed ? ['PENDING_ACCEPTANCE','ACCEPTED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED'] as const
        : b.status === 'EN_ROUTE' ? ['PENDING_ACCEPTANCE','ACCEPTED','EN_ROUTE'] as const : ['PENDING_ACCEPTANCE','ACCEPTED'] as const;
      await tx.insert(bookingEvents).values(statuses.map((status,j) => ({ id: demoId(1000+i*10+j), bookingId: b.id, status, actorId: status === 'PENDING_ACCEPTANCE' ? b.customer : b.pro,
        note: completed && status === 'COMPLETED' ? 'Historical completion confirmed before imported earnings.' : null,
        createdAt: b.id === DEMO.active ? j === 0 ? ago(11) : j === 1 ? ago(7) : ago(1) : new Date(createdAt.getTime() + (b.at.getTime()-createdAt.getTime()) * j / (statuses.length-1)) }))).onConflictDoNothing();
      ledger('ESCROW_HOLD', createdAt, b.id, [[`customer:${b.customer}`,-total],[`escrow:${b.id}`,total]]);
      if (completed) {
        const split = splitPayout(service.priceCentavos);
        ledger('ESCROW_RELEASE', b.at, b.id, [[`escrow:${b.id}`,-total],[`pro_wallet:${b.pro}`,split.proCentavos],['platform_revenue',split.platformCentavos+fee]]);
        if (b.tip) ledger('TIP', new Date(b.at.getTime()+1),b.id,[[`customer:${b.customer}`,-b.tip],[`pro_wallet:${b.pro}`,b.tip]]);
        await tx.insert(reviews).values({ id: demoId(2000+i), bookingId: b.id, authorId: b.customer, subjectId: b.pro, rating: 5, compliments: ['Polite','Clean Work'], body: 'Clear communication and careful work. Thank you!', createdAt: b.at }).onConflictDoNothing();
      }
    }
    // Imported prior earnings are explicit balances, never invented service prices.
    ledger('OPENING_BALANCE',ago(30*1440),undefined,[[`pro_wallet:${DEMO.daniel}`,656450],['opening_balance_clearing',-656450]],'Previous earnings');
    ledger('OPENING_BALANCE',today(0.2),undefined,[[`pro_wallet:${DEMO.daniel}`,57375],['opening_balance_clearing',-57375]],'Previous earnings');
    ledger('PAYOUT',ago(4*1440),undefined,[[`pro_wallet:${DEMO.daniel}`,-251500],['payout_clearing',250000],['platform_revenue',1500]],'GCash 0917***4567 · ₱2,500 cashout + ₱15 fee');
    await tx.insert(ledgerEntries).values(entries).onConflictDoNothing();
    await tx.insert(payouts).values({ id: demoId(3000), proId: DEMO.daniel, amountCentavos: 250000, feeCentavos: 1500, destinationMasked: '0917***4567', status: 'PAID', createdAt: ago(4*1440) }).onConflictDoNothing();
    const chat = [
      { senderId: null, body: 'Order #SRV-8821 accepted. Escrow of ₱1,150 authorized.', at: ago(7) },
      { senderId: DEMO.daniel, body: 'Hi Sophia! I’m on my way. Is parking available near the gate?', at: ago(2) },
      { senderId: DEMO.customer, body: 'Yes, use Gate 2. The guard can point you to visitor parking.', at: ago(1.5) },
      { senderId: DEMO.daniel, body: 'Perfect, thank you. I’ll message when I arrive.', at: ago(1.25) },
    ];
    await tx.insert(messages).values(chat.map((m,i) => ({ id: demoId(4000+i), bookingId: DEMO.active, senderId: m.senderId, body: m.body, createdAt: m.at }))).onConflictDoNothing();
    for (const [i,b] of DEMO_BULLETIN.entries()) {
      const service = sku(b.skuId); const loc = DEMO_LOCATIONS[i]!;
      await tx.insert(bulletinRequests).values({ id: demoId(6000+i), isDemo: true, authorId: DEMO_AUTHORS[i]!.id, categoryId: service.categoryId, skuId: b.skuId,
        description: b.description, urgent: b.status === 'URGENT', status: b.status, neighborhood: `Barangay ${loc.barangay}`, lat: loc.lat, lng: loc.lng, createdAt: ago(b.minutes) }).onConflictDoNothing();
    }
    // Explicit demo codes must never collide with the next ordinary booking.
    await tx.execute(sql`SELECT setval('booking_code_seq', GREATEST((SELECT last_value FROM booking_code_seq), (SELECT MAX(substring(code FROM 5)::bigint) FROM bookings WHERE code ~ '^SRV-[0-9]+$')), true)`);
    if (!prior) {
      const balances = await tx.execute<{ available: string; today: string }>(sql`SELECT SUM(amount_centavos)::text AS available,
        SUM(amount_centavos) FILTER (WHERE amount_centavos > 0 AND created_at >= ${new Date(midnight)})::text AS today FROM ledger_entries WHERE account=${`pro_wallet:${DEMO.daniel}`}`);
      const pending = all.filter((b) => b.status !== 'COMPLETED').reduce((sum,b) => sum + splitPayout(sku(b.sku).priceCentavos).proCentavos,0);
      if (balances.rows[0]!.available !== '864075' || balances.rows[0]!.today !== '331625' || pending !== 187000) throw new Error('Demo wallet baseline did not reconcile.');
    }
    return { created: !prior, users: accounts.length, bookings: all.length, bulletin: DEMO_BULLETIN.length, ledgerEntries: entries.length };
  });
}
