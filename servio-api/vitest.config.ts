// test config
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));

try {
  process.loadEnvFile('.env');
} catch {
}

const testDb = process.env.TEST_LOCAL_DATABASE_URL;
if (testDb && !/^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(testDb)) {
  throw new Error('TEST_LOCAL_DATABASE_URL must point at localhost.');
}

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      remoteBindings: false,
      miniflare: {
        bindings: {
          ENVIRONMENT: 'development',
          TEST_HAS_DATABASE: testDb ? 'true' : 'false',
          ...(testDb ? { DATABASE_URL: testDb } : {}),
          SMTP_USER: '',
          SMTP_PASSWORD: '',
          PIN_SECRET: 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=',
        },
      },
    }),
  ],
  resolve: {
    alias: {
      'pg-protocol': local('./node_modules/pg-protocol/dist/index.js'),
      'pg-cloudflare': local('./node_modules/pg-cloudflare/dist/index.js'),
    },
  },
  test: {
    fileParallelism: false,
    onUnhandledError: (error) => (error.message === 'This socket has been closed.' ? false : undefined),
  },
});
