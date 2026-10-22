CREATE TABLE "customer_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"milestone" smallint NOT NULL,
	"percent_off" smallint NOT NULL,
	"max_discount_centavos" integer NOT NULL,
	"status" text DEFAULT 'AVAILABLE' NOT NULL,
	"booking_id" uuid,
	"redeemed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_coupons_status_chk" CHECK ("customer_coupons"."status" IN ('AVAILABLE','REDEEMED')),
	CONSTRAINT "customer_coupons_redemption_chk" CHECK (("customer_coupons"."status" = 'AVAILABLE') = ("customer_coupons"."booking_id" IS NULL)),
	CONSTRAINT "customer_coupons_amount_chk" CHECK ("customer_coupons"."percent_off" BETWEEN 1 AND 90 AND "customer_coupons"."max_discount_centavos" > 0)
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_chk";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_centavos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_coupons" ADD CONSTRAINT "customer_coupons_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_coupons" ADD CONSTRAINT "customer_coupons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_coupons_milestone_uq" ON "customer_coupons" USING btree ("customer_id","milestone");--> statement-breakpoint
CREATE INDEX "customer_coupons_booking_idx" ON "customer_coupons" USING btree ("booking_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_discount_chk" CHECK ("bookings"."discount_centavos" >= 0 AND "bookings"."discount_centavos" < "bookings"."price_centavos");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_chk" CHECK ("notifications"."kind" IN ('BOOKING','MESSAGE','ADDON','OFFER','BULLETIN','REVIEW','REWARD'));