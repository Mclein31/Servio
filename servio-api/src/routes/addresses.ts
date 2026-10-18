import { and, asc, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { validateServiceLocation } from '../lib/service-area';
import { userAddresses, users } from '../db/schema';
import type { AppEnv } from '../env';
import { ApiError } from '../lib/errors';
import { validate } from '../lib/validation';
import { requireUser } from '../middleware/auth';
import { withDb } from '../middleware/db';

const text = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));
const fields = {
  label: text(50), street: text(200), barangay: text(100), city: text(100),
  landmark: v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(200))),
  lat: v.pipe(v.number(), v.minValue(-90), v.maxValue(90)),
  lng: v.pipe(v.number(), v.minValue(-180), v.maxValue(180)),
  isDefault: v.boolean(),
};
const CreateAddress = v.strictObject({ ...fields, landmark: v.optional(fields.landmark), isDefault: v.optional(fields.isDefault) });
const PatchAddress = v.pipe(v.partial(v.strictObject(fields)), v.check((input) => Object.keys(input).length > 0, 'Provide an address field.'));
const AddressId = v.strictObject({ id: v.pipe(v.string(), v.uuid()) });
const publicFields = { id: userAddresses.id, label: userAddresses.label, street: userAddresses.street,
  barangay: userAddresses.barangay, city: userAddresses.city, landmark: userAddresses.landmark,
  lat: userAddresses.lat, lng: userAddresses.lng, isDefault: userAddresses.isDefault };

export const addresses = new Hono<AppEnv>();
addresses.use('/me/addresses', withDb, requireUser);
addresses.use('/me/addresses/*', withDb, requireUser);

addresses.get('/me/addresses', async (c) => {
  const rows = await c.get('db').select(publicFields).from(userAddresses).where(eq(userAddresses.userId, c.get('userId')))
    .orderBy(desc(userAddresses.isDefault), asc(userAddresses.createdAt), asc(userAddresses.id));
  return c.json({ addresses: rows });
});

addresses.post('/me/addresses', validate('json', CreateAddress), async (c) => {
  const input = c.req.valid('json');
  validateServiceLocation(input);
  const userId = c.get('userId');
  const address = await c.get('db').transaction(async (tx) => {
    // The owner row exists even for an empty address book: all default changes serialize here.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const [prior] = await tx.select({ id: userAddresses.id }).from(userAddresses).where(eq(userAddresses.userId, userId)).limit(1);
    const isDefault = !prior || input.isDefault === true;
    if (isDefault) await tx.update(userAddresses).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(userAddresses.userId, userId), eq(userAddresses.isDefault, true)));
    const [row] = await tx.insert(userAddresses).values({ ...input, userId, isDefault }).returning(publicFields);
    return row!;
  });
  return c.json({ address }, 201);
});

addresses.patch('/me/addresses/:id', validate('param', AddressId), validate('json', PatchAddress), async (c) => {
  const input = c.req.valid('json');
  const userId = c.get('userId');
  const id = c.req.valid('param').id;
  const address = await c.get('db').transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const owned = and(eq(userAddresses.id, id), eq(userAddresses.userId, userId));
    const [prior] = await tx.select().from(userAddresses).where(owned);
    if (!prior) throw new ApiError(404, 'NOT_FOUND', 'Address not found.');
    validateServiceLocation({ ...prior, ...input });
    if (prior.isDefault && input.isDefault === false) throw new ApiError(422, 'DEFAULT_REQUIRED', 'Choose another address as the default first.');
    if (input.isDefault === true) await tx.update(userAddresses).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(userAddresses.userId, userId), eq(userAddresses.isDefault, true)));
    const [row] = await tx.update(userAddresses).set({ ...input, updatedAt: new Date() }).where(owned).returning(publicFields);
    return row!;
  });
  return c.json({ address });
});

addresses.delete('/me/addresses/:id', validate('param', AddressId), async (c) => {
  const userId = c.get('userId');
  const id = c.req.valid('param').id;
  await c.get('db').transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const [deleted] = await tx.delete(userAddresses).where(and(eq(userAddresses.id, id), eq(userAddresses.userId, userId))).returning({ isDefault: userAddresses.isDefault });
    if (!deleted) throw new ApiError(404, 'NOT_FOUND', 'Address not found.');
    if (deleted.isDefault) {
      const [next] = await tx.select({ id: userAddresses.id }).from(userAddresses).where(eq(userAddresses.userId, userId)).orderBy(asc(userAddresses.createdAt), asc(userAddresses.id)).limit(1);
      if (next) await tx.update(userAddresses).set({ isDefault: true, updatedAt: new Date() }).where(eq(userAddresses.id, next.id));
    }
  });
  return c.json({ deleted: true });
});
