CREATE TABLE "support_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_key" uuid NOT NULL,
	"booking_id" uuid,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_requests_message_chk" CHECK (char_length("support_requests"."message") BETWEEN 10 AND 2000),
	CONSTRAINT "support_requests_category_chk" CHECK ("support_requests"."category" IN ('BOOKING','PAYMENT','SAFETY','ACCOUNT','OTHER')),
	CONSTRAINT "support_requests_status_chk" CHECK ("support_requests"."status" IN ('OPEN','REVIEWING','RESOLVED'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferred_payment_method" text DEFAULT 'GCASH' NOT NULL;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "support_requests_retry_uq" ON "support_requests" USING btree ("user_id","client_key");--> statement-breakpoint
CREATE INDEX "support_requests_owner_created_idx" ON "support_requests" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_payment_method_chk" CHECK ("users"."preferred_payment_method" IN ('GCASH','CARD'));