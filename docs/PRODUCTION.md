# SERVIO deployed backend and native app updates

Production API: https://servio-api.mcleinonza0531.workers.dev/api/v1

The API is a Cloudflare Worker backed by the SERVIO Neon production branch through Hyperdrive and the SERVIO R2 bucket. `/health` must report `environment: production` and `database: ok`. A healthy response does not prove every app endpoint is included in the deployed version.

## Current update — October 18, 2026

Worker version: `6d8fca71-c659-4d6c-b871-3d6fa67f39ca`.

Applied additive migrations `0008_bulletin_acceptance` and `0009_profile_help_payments` using the existing direct production connection; migration history advanced from 8 to 10 entries. Do not run local database reset or seed commands against production.

This update includes Pro Bulletin reservation and customer checkout linkage; saved category/actual offered services; payment preferences; and support reports. Payments, refunds and payouts remain simulated.

Authenticated production smoke checks passed for saving/reopening category and payment preference, submitting/reopening a report, and accepting/releasing a Bulletin request. Temporary smoke-test identities and records were removed; no production booking or hold was created. Local API browser verification completed the full Pro acceptance → customer checkout → Tracking flow.

## Update the phone app

From `servio-app`:

```sh
npm run native:production
npx cap open ios
```

Select the connected iPhone in Xcode and Run using the configured signing team. For Android, use `npx cap open android` and Run on the connected device. Production preparation uses the deployed HTTPS API and disables offline mode and cleartext networking, even when using a native Debug install for device testing. No Mac-hosted API is needed by that app.

Preparing/syncing copies web assets into the native projects. It does not update an app already installed on a phone. Rebuild and install after frontend changes. A backend-only deployment can fix missing endpoint errors without reinstalling, but new screens and click handlers require the updated app.

The branded preload lasts two seconds with an orange spinner. Slow initial navigation uses a separate connection status rather than extending the branded splash indefinitely.

## Staff support API

Only an authenticated ADMIN may GET `/support/admin/requests` or POST `/support/admin/requests/:id` with status `OPEN`, `REVIEWING`, or `RESOLVED`. Users can list and submit their own reports at `/support/requests`. No external support email or promised response time is configured.

Latest update also deploys owner request cancellation, individual service withdrawal and measured-origin/freshness-aware discovery. No additional migration was needed. Live endpoint smoke checks passed; client loading no longer waits for profile/helper photos or GPS. 191 backend and 83 client tests pass.
