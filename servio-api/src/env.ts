import type { Database } from './db/client';

export interface Bindings {
  ENVIRONMENT: string;
  ORDER_ROOMS: DurableObjectNamespace;
  GEOCODER: DurableObjectNamespace;
  GEOCODING_URL?: string;
  LAUNCH_CITY?: string;
  ALLOWED_ORIGINS: string;
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
  UPLOADS: R2Bucket;
  UPLOADS_MODE?: string;
  R2_BUCKET_NAME: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  AUTH_LIMITER?: RateLimit;
  DEMO_LOGIN_CODE?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;
  PIN_SECRET?: string;
  TRUST_FEE_CENTAVOS?: string;
}

export interface Variables {
  requestId: string;
  db: Database;
  userId: string;
  liveHints?: LiveHints;
}

export interface LiveHints {
  previousProId?: string | null;
  replay?: boolean;
  dispatch?: DispatchResult;
}
export interface DispatchResult { offered: { offerId: string; bookingId: string; proId: string }[]; cancelled: string[] }

export type AppEnv = { Bindings: Bindings; Variables: Variables };
