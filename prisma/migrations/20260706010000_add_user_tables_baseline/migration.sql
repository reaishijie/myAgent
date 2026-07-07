CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO', 'MAX');
CREATE TYPE "UserStatus" AS ENUM ('NORMAL', 'DISABLED', 'DELETED');

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "avatar" VARCHAR(255),
  "username" VARCHAR(30) NOT NULL,
  "nickname" VARCHAR(30),
  "password" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255),
  "phone" VARCHAR(15),
  "status" "UserStatus" NOT NULL DEFAULT 'NORMAL',
  "plan" "UserPlan" NOT NULL DEFAULT 'FREE',
  "balance" DECIMAL(12, 2) DEFAULT 0,
  "plan_end_time" TIMESTAMP(6),
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  "profile" JSONB
);

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE INDEX "user_status_idx" ON "users"("status");
CREATE INDEX "user_created_idx" ON "users"("created_at");
CREATE INDEX "user_plan_time_idx" ON "users"("plan", "plan_end_time");
