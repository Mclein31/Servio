// event-armed dispatch Durable Object
import { DurableObject } from 'cloudflare:workers';
import type { Bindings } from '../env';
import { clampDispatchTime, runScheduledDispatch } from './scheduled';

export interface DispatcherDeps {
  runDispatch?: typeof runScheduledDispatch;
  now?: () => number;
}

export class Dispatcher extends DurableObject<Bindings> {
  private readonly run: typeof runScheduledDispatch;
  private readonly now: () => number;

  constructor(ctx: DurableObjectState, env: Bindings, deps: DispatcherDeps = {}) {
    super(ctx, env);
    this.run = deps.runDispatch ?? runScheduledDispatch;
    this.now = deps.now ?? (() => Date.now());
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/arm') {
      return new Response('Not found', { status: 404 });
    }
    let atMs: number | undefined;
    try {
      const body = await request.json() as { atMs?: unknown };
      if (typeof body?.atMs === 'number') atMs = body.atMs;
    } catch {
      // Allow empty POST /arm body to arm at the default minimum delay.
    }
    return Response.json(await this.arm(atMs));
  }

  /** Arms the single DO alarm idempotently without delaying an already-earlier wakeup. */
  async arm(atMs?: number): Promise<{ armed: boolean; alarmAt: number }> {
    const targetAt = clampDispatchTime(atMs, this.now());
    return this.ctx.blockConcurrencyWhile(async () => {
      const existing = await this.ctx.storage.getAlarm();
      if (existing !== null && existing <= targetAt) {
        return { armed: false, alarmAt: existing };
      }
      await this.ctx.storage.setAlarm(targetAt);
      return { armed: true, alarmAt: targetAt };
    });
  }

  /** Advances held bookings on alarm wakeup and re-arms only while work remains. */
  async alarm(): Promise<void> {
    const { nextAt } = await this.run(this.env);
    if (nextAt !== null) {
      await this.arm(nextAt);
    }
  }
}
