import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { addonSkus, categories, serviceSkus } from '../db/schema';
import type { AppEnv } from '../env';
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
  return c.json({ categories: cats, skus, addons });
});
