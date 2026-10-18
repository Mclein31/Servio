ALTER TABLE "bulletin_requests" ADD COLUMN "accepted_pro_id" uuid;--> statement-breakpoint
ALTER TABLE "bulletin_requests" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bulletin_requests" ADD COLUMN "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "bulletin_requests" ADD CONSTRAINT "bulletin_requests_accepted_pro_id_users_id_fk" FOREIGN KEY ("accepted_pro_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletin_requests" ADD CONSTRAINT "bulletin_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;