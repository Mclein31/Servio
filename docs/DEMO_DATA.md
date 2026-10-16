# SERVIO local demo data

The ordinary development database is `servio_dev`; tests use `servio_test`. Full reset/restore require a separate **`servio_demo`** database. They refuse production, other project databases and existing non-demo rows. This preserves normal development data. No cloud resources are required.

Use Node 26. From `servio-api`:

```sh
nvm use 26
createdb servio_demo # once; local Postgres must already be running
export DATABASE_URL_UNPOOLED="postgresql://$USER@localhost:5432/servio_demo"
npm run db:demo-reset
npm run db:backup
```

Reset migrates an empty database, truncates the disposable demo tables, seeds the fixed catalog, then seeds the accounts/history/images. `uploads` metadata is included. Only this dedicated database path bypasses row-level append-only guards by TRUNCATE. The seed is idempotent; seed alone preserves progress.

Backups are custom-format `servio-api/backups/servio-servio_demo-<timestamp>.dump`, ignored by Git. Keep a copy on the Mac before demo day. Restore into the dedicated demo database with:

```sh
npm run db:restore -- backups/servio-servio_demo-<timestamp>.dump
```

The API reads **DATABASE_URL**, not the migration override. For the presentation server, set `DATABASE_URL` in the ignored `servio-api/.env` to the same local `servio_demo` URL, restart the API, then sign in again. Do not point the test database URL at it. The current development server may keep using `servio_dev` until rehearsal.

Set a private six-digit `DEMO_LOGIN_CODE` in that ignored file and restart the API. Use `demo.customer@servio.test` (Sophia M.) and `demo.pro@servio.test` (Daniel K.); tutor `demo.tutor@servio.test` is Sofia R. Staff cannot use mobile sign-in. No email delivery is required. Check the code locally; never commit the environment file.

Tracking’s “Reset demo order” is available only in a demo build for a signed-in demo account. The server permits only Sophia/Daniel for the reserved SRV-8821 booking. It appends a balanced compensation reversing that order’s net ledger movements, restores the original base hold and EN_ROUTE state, clears mutable quotes/review and adjusts the corresponding rating/job increment. Existing ledger rows, chat and booking events remain. The current stepper starts at the latest reset marker; earlier events stay in the API audit history. Other bookings and cashouts are preserved. If the order’s earnings were already withdrawn and cannot be reversed without a negative wallet, use the full disposable-database reset instead.

Images live separately in the local Wrangler R2 binding; reset uploads the four bundled baseline images again. Database backups contain metadata, not R2 bytes. Preserve `servio-api/.wrangler/state` for any additional photos you need to retain.

After owner-approved Neon setup, create a `demo-baseline` branch from the freshly seeded dedicated demo branch. Rehearse on a child branch and use Neon “Reset from parent” to restore that child. This has not been performed: no SERVIO Neon project exists, and cloud deployment still needs owner approval. Never run demo tools against a production or another project’s branch.
