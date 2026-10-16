ALTER TABLE "bookings" ADD COLUMN "schedule_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "schedule_end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "expected_arrival_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "no_show_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pro_profiles" ADD COLUMN "cancellation_strikes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_schedule_window_chk" CHECK (("bookings"."schedule_start_at" IS NULL AND "bookings"."schedule_end_at" IS NULL) OR ("bookings"."schedule_start_at" IS NOT NULL AND "bookings"."schedule_end_at" IS NOT NULL AND "bookings"."schedule_end_at" > "bookings"."schedule_start_at"));