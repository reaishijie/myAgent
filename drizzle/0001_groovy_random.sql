ALTER TABLE "users" ADD COLUMN "phone" varchar(15);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");