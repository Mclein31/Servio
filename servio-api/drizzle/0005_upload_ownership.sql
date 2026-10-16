CREATE TABLE "uploads" (
	"key" text PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"content_type" text NOT NULL,
	"content_length" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploads_length_chk" CHECK ("uploads"."content_length" > 0 AND "uploads"."content_length" <= 10485760)
);
--> statement-breakpoint
ALTER TABLE "bulletin_requests" ADD COLUMN "photo_key" text;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uploads_owner_idx" ON "uploads" USING btree ("owner_id");