CREATE TYPE "public"."user_plan" AS ENUM('FREE', 'PRO', 'MAX');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('NORMAL', 'DISABLED', 'DELETED');--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"avatar" varchar(255),
	"username" varchar(30) NOT NULL,
	"nickname" varchar(30),
	"password" varchar(255) NOT NULL,
	"email" varchar(255),
	"status" "user_status" DEFAULT 'NORMAL' NOT NULL,
	"plan" "user_plan" DEFAULT 'FREE' NOT NULL,
	"money" numeric(12, 2) DEFAULT 0,
	"plan_end_time" timestamp,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"profile" json,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "user_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_created_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_plan_time_idx" ON "users" USING btree ("plan","plan_end_time");