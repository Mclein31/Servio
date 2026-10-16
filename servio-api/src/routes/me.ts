import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { bookings, proProfiles, proSkus, serviceSkus, users } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { ownedUpload, UPLOAD_KEY } from '../lib/uploads';
import { validate } from '../lib/validation';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';

export const me = new Hono<AppEnv>();
me.use('/me', withDb, requireUser);
me.use('/me/*', withDb, requireUser);

const profileFields = { id: users.id, isDemo: users.isDemo, email: users.email, fullName: users.fullName, phoneNumber: users.phoneNumber, role: users.role, avatarKey: users.avatarKey };

me.get('/me', async (c) => {
  const db = c.get('db');
  const [user] = await db.select(profileFields).from(users).where(eq(users.id, c.get('userId'))).limit(1);
  const [pro] = user ? await db.select().from(proProfiles).where(eq(proProfiles.userId, user.id)).limit(1) : [];
  return c.json({ me: user, pro: pro ?? null });
});

const PatchProfile = v.pipe(v.strictObject({
  fullName: v.optional(v.pipe(v.string(), v.trim(), v.minLength(2, 'Enter your name.'), v.maxLength(80))),
  avatarKey: v.optional(v.nullable(v.pipe(v.string(),v.regex(UPLOAD_KEY)))),
  /** Philippine mobile in E.164 (+639XXXXXXXXX). */
  phoneNumber: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.regex(/^\+639\d{9}$/, 'Use a Philippine mobile number, e.g. +639171234567.')))),
}), v.check((value)=>Object.keys(value).length>0,'Provide a profile field.'));

me.patch('/me', validate('json', PatchProfile), async (c) => {
  const patch = c.req.valid('json');
  if(patch.avatarKey) await ownedUpload(c.get('db'),c.env,patch.avatarKey,c.get('userId'),'avatar');
  const [user] = await c.get('db').update(users).set(patch).where(eq(users.id, c.get('userId'))).returning(profileFields);
  return c.json({ me: user });
});

const UpgradeProSchema = v.strictObject({
  categoryId: v.optional(v.picklist(['tutoring', 'repairs', 'errands', 'beauty', 'tech'])),
  headline: v.optional(v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(80))),
});

const DEFAULT_TRADE_HEADLINES: Record<string, string> = {
  repairs: 'Repairs Specialist',
  tutoring: 'Academic Tutor',
  errands: 'Errands & Delivery',
  beauty: 'Beauty & Care',
  tech: 'Tech Specialist',
};

me.post('/me/upgrade-pro', validate('json', UpgradeProSchema), async (c) => {
  const input = c.req.valid('json');
  const db = c.get('db');
  const userId = c.get('userId');
  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'User not found.');
    if (current.role === 'ADMIN') throw new ApiError(403, 'FORBIDDEN', 'Staff accounts cannot change their role.');

    const [updatedUser] = await tx.update(users)
      .set({ role: 'PRO' })
      .where(eq(users.id, userId))
      .returning(profileFields);

    const targetCategory = input.categoryId ?? 'repairs';
    const headline = input.headline ?? DEFAULT_TRADE_HEADLINES[targetCategory] ?? 'Repairs Specialist';

    const [existingPro] = await tx.select().from(proProfiles).where(eq(proProfiles.userId, userId)).limit(1);
    let pro = existingPro;
    if (!existingPro) {
      const [newPro] = await tx.insert(proProfiles).values({
        userId,
        headline,
        bio: 'Verified local service provider on SERVIO.',
        credentials: ['Verified Identity'],
        yearsExperience: 2,
        kycStatus: 'APPROVED',
        isOnline: false,
        ratingAvg: '5.00',
        ratingCount: 1,
        ratingSum: 5,
        jobsDone: 0,
      }).returning();
      pro = newPro;
    } else {
      const [updatedPro] = await tx.update(proProfiles)
        .set({
          kycStatus: 'APPROVED',
          headline: input.headline ?? (existingPro.headline && existingPro.headline !== 'Community Service Professional' ? existingPro.headline : headline),
        })
        .where(eq(proProfiles.userId, userId))
        .returning();
      pro = updatedPro;
    }

    // Assign only SKUs belonging to the chosen category
    await tx.delete(proSkus).where(eq(proSkus.proId, userId));
    const catSkus = await tx.select({ id: serviceSkus.id })
      .from(serviceSkus)
      .where(and(eq(serviceSkus.categoryId, targetCategory), eq(serviceSkus.isActive, true)));
    if (catSkus.length > 0) {
      await tx.insert(proSkus)
        .values(catSkus.map((sku) => ({ proId: userId, skuId: sku.id })))
        .onConflictDoNothing();
    }

    return { me: updatedUser!, pro: pro! };
  });

  return c.json(result);
});

const SetProTradeSchema = v.strictObject({
  categoryId: v.picklist(['tutoring', 'repairs', 'errands', 'beauty', 'tech']),
  headline: v.optional(v.pipe(v.string(), v.trim(), v.minLength(2), v.maxLength(80))),
});

me.post('/me/pro-trade', validate('json', SetProTradeSchema), async (c) => {
  const { categoryId, headline: customHeadline } = c.req.valid('json');
  const db = c.get('db');
  const userId = c.get('userId');
  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select(profileFields).from(users).where(eq(users.id, userId)).limit(1);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'User not found.');
    const [pro] = await tx.select().from(proProfiles).where(eq(proProfiles.userId, userId)).limit(1);
    if (!pro) throw new ApiError(403, 'PRO_REQUIRED', 'Pro profile required.');

    const headline = customHeadline ?? DEFAULT_TRADE_HEADLINES[categoryId] ?? 'Service Professional';
    const [updatedPro] = await tx.update(proProfiles)
      .set({ headline })
      .where(eq(proProfiles.userId, userId))
      .returning();

    await tx.delete(proSkus).where(eq(proSkus.proId, userId));
    const catSkus = await tx.select({ id: serviceSkus.id })
      .from(serviceSkus)
      .where(and(eq(serviceSkus.categoryId, categoryId), eq(serviceSkus.isActive, true)));
    if (catSkus.length > 0) {
      await tx.insert(proSkus)
        .values(catSkus.map((sku) => ({ proId: userId, skuId: sku.id })))
        .onConflictDoNothing();
    }

    return { me: current, pro: updatedPro! };
  });

  return c.json(result);
});

const SwitchRoleSchema = v.strictObject({
  role: v.picklist(['CUSTOMER', 'PRO']),
});

me.post('/me/switch-role', validate('json', SwitchRoleSchema), async (c) => {
  const { role } = c.req.valid('json');
  const db = c.get('db');
  const userId = c.get('userId');
  const result = await db.transaction(async (tx) => {
    const [current] = await tx.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'User not found.');
    if (current.role === 'ADMIN') throw new ApiError(403, 'FORBIDDEN', 'Staff accounts cannot change their role.');

    if (role === 'PRO') {
      const [existingPro] = await tx.select().from(proProfiles).where(eq(proProfiles.userId, userId)).limit(1);
      if (!existingPro || existingPro.kycStatus !== 'APPROVED') {
        throw new ApiError(403, 'PRO_REQUIRED', 'Complete Pro onboarding before switching to Pro mode.');
      }
      const [updatedUser] = await tx.update(users)
        .set({ role: 'PRO' })
        .where(eq(users.id, userId))
        .returning(profileFields);
      return { me: updatedUser!, pro: existingPro };
    } else {
      const [active] = await tx.select({ id: bookings.id, code: bookings.code })
        .from(bookings)
        .where(and(
          eq(bookings.proId, userId),
          inArray(bookings.status, ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'])
        ))
        .limit(1);
      if (active) {
        throw new ApiError(409, 'ACTIVE_BOOKINGS_EXIST', `Complete or cancel active job #${active.code ?? active.id} before switching to Customer mode.`);
      }
      await tx.update(proProfiles).set({ isOnline: false }).where(eq(proProfiles.userId, userId));
      const [updatedUser] = await tx.update(users)
        .set({ role: 'CUSTOMER' })
        .where(eq(users.id, userId))
        .returning(profileFields);
      const [pro] = await tx.select().from(proProfiles).where(eq(proProfiles.userId, userId)).limit(1);
      return { me: updatedUser!, pro: pro ?? null };
    }
  });

  return c.json(result);
});
