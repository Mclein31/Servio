import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { addonSkus, categories, serviceSkus } from '../db/schema';
import type { AppEnv } from '../env';
import { cityProfile, CANCELLATION_FEES } from '../config/cities';
import { TRUST_FEE_CENTAVOS } from '../lib/money';
import { withDb } from '../middleware/db';

export const catalog = new Hono<AppEnv>();
catalog.use('/catalog', withDb);

/** Public catalog (ADR-001 fixed SKUs). Prices are centavos; clients format as ₱. */
catalog.get('/catalog', async (c) => {
  const db = c.get('db');
  const [cats, skus, addons] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db
      .select({
        id: serviceSkus.id,
        categoryId: serviceSkus.categoryId,
        name: serviceSkus.name,
        priceCentavos: serviceSkus.priceCentavos,
        unit: serviceSkus.unit,
        durationLabel: serviceSkus.durationLabel,
        inclusions: serviceSkus.inclusions,
      })
      .from(serviceSkus)
      .where(eq(serviceSkus.isActive, true))
      .orderBy(asc(serviceSkus.categoryId), asc(serviceSkus.priceCentavos)),
    db
      .select({ id: addonSkus.id, name: addonSkus.name, detail: addonSkus.detail, priceCentavos: addonSkus.priceCentavos })
      .from(addonSkus)
      .where(eq(addonSkus.isActive, true))
      .orderBy(asc(addonSkus.priceCentavos)),
  ]);
  c.header('Cache-Control', 'public, max-age=300');
  const fee = Number(c.env.TRUST_FEE_CENTAVOS ?? TRUST_FEE_CENTAVOS);
  const profile = cityProfile(c.env.LAUNCH_CITY);
  return c.json({ categories: cats, skus, addons, cancellationFees: CANCELLATION_FEES,
    serviceArea: { city: profile.addressCity, name: profile.name, center: profile.center, radiusKm: profile.dispatchRadiusKm },
    trustFeeCentavos: Number.isInteger(fee) && fee >= 0 ? fee : TRUST_FEE_CENTAVOS });
});
