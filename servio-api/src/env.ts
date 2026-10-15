import type { Database } from './db/client';

/** Worker bindings. Secrets come from servio-api/.env locally and `wrangler secret put` when deployed. */
export interface Bindings {
  ENVIRONMENT: string;
  /** Comma-separated origins allowed by CORS (includes the Capacitor app origins). */
  ALLOWED_ORIGINS: string;
  /** Present in deployed environments; preferred over DATABASE_URL. */
  HYPERDRIVE?: Hyperdrive;
  /** Direct Postgres/Neon connection string (local dev and fallback). */
  DATABASE_URL?: string;
  UPLOADS: R2Bucket;
  R2_BUCKET_NAME: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  /** Sign-in code requests/attempts per IP and per email (wrangler.toml [[ratelimits]]). */
  AUTH_LIMITER?: RateLimit;
  /** Outgoing email (sign-in codes). Gmail: smtp.gmail.com, 465, the address, and an App Password. */
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;
  /** 32+ random bytes, base64. Derives completion PINs (escrow release). */
  PIN_SECRET?: string;
}

export interface Variables {
  requestId: string;
  /** Set by `withDb`. */
  db: Database;
  /** Set by `requireUser` from the server-side session. */
  userId: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
