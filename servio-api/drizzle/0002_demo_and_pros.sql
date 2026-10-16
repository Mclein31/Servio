CREATE SEQUENCE "public"."booking_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999 START WITH 8800 CACHE 1;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "code" SET DEFAULT 'SRV-' || nextval('booking_code_seq')::text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bulletin_requests" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;