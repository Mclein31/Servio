ALTER TABLE "bookings" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "request_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_customer_idempotency_uq" ON "bookings" USING btree ("customer_id","idempotency_key");