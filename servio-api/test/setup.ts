// test runtime setup for cloudflare:* built-ins
import { registerHooks } from 'node:module';

const SETUP_KEY = Symbol.for('servio.test.cloudflareHooks');
const g = globalThis as Record<symbol, boolean>;

if (!g[SETUP_KEY]) {
  g[SETUP_KEY] = true;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'cloudflare:workers' || specifier === 'cloudflare:sockets') {
        return { shortCircuit: true, url: `cfstub:${specifier}` };
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === 'cfstub:cloudflare:workers') {
        return {
          shortCircuit: true,
          format: 'module',
          source: 'export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }',
        };
      }
      if (url === 'cfstub:cloudflare:sockets') {
        return {
          shortCircuit: true,
          format: 'module',
          source: 'export function connect() { throw new Error("cloudflare:sockets is stubbed in unit tests"); }',
        };
      }
      return nextLoad(url, context);
    },
  });
}
