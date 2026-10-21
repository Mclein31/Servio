// catalog seeding
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { ADDON_ROWS, CATEGORY_ROWS, SKU_ROWS } from '../src/db/catalog-data';
import { addonSkus, categories, serviceSkus } from '../src/db/schema';

try {
  process.loadEnvFile('.env');
} catch {
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL (or DATABASE_URL_UNPOOLED) in servio-api/.env');

const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
const client = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: true } });
await client.connect();
const db = drizzle(client);

try {
  await db.transaction(async (tx) => {
    await tx
      .insert(categories)
      .values([...CATEGORY_ROWS])
      .onConflictDoUpdate({ target: categories.id, set: { label: sql`excluded.label`, icon: sql`excluded.icon`, sortOrder: sql`excluded.sort_order` } });

    await tx
      .insert(serviceSkus)
      .values(SKU_ROWS.map((s) => ({ ...s, inclusions: [...s.inclusions] })))
      .onConflictDoUpdate({
        target: serviceSkus.id,
        set: {
          categoryId: sql`excluded.category_id`,
          name: sql`excluded.name`,
          priceCentavos: sql`excluded.price_centavos`,
          unit: sql`excluded.unit`,
          durationLabel: sql`excluded.duration_label`,
          inclusions: sql`excluded.inclusions`,
        },
      });

    await tx
      .insert(addonSkus)
      .values([...ADDON_ROWS])
      .onConflictDoUpdate({ target: addonSkus.id, set: { name: sql`excluded.name`, detail: sql`excluded.detail`, priceCentavos: sql`excluded.price_centavos` } });
  });
  console.log(`Seeded ${CATEGORY_ROWS.length} categories, ${SKU_ROWS.length} SKUs, ${ADDON_ROWS.length} add-ons → ${new URL(url).host}${new URL(url).pathname}`);
} finally {
  await client.end();
}
