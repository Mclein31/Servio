import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile('.env');
} catch {
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '' },
});
