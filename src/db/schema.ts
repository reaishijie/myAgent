import { sql } from 'drizzle-orm';
import { pgTable, serial, numeric, varchar, timestamp, pgEnum, index, json } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['USER', 'ADMIN']);
export const userPlanEnum = pgEnum('user_plan', ['FREE', 'PRO', 'MAX']);
export const userStatusEnum = pgEnum('user_status', ['NORMAL', 'DISABLED', 'DELETED']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  avatar: varchar('avatar', { length: 255 }),
  username: varchar('username', { length: 30 }).unique().notNull(),
  nickname: varchar('nickname', { length: 30 }),
  password: varchar('password', { length: 255 }).notNull(), // 哈希过的密码
  email: varchar('email', { length: 255 }).unique(),
  phone: varchar('phone', { length: 15 }).unique(),
  status: userStatusEnum('status').notNull().default('NORMAL'),
  plan: userPlanEnum('plan').notNull().default('FREE'),
  money: numeric('money', { precision: 12, scale: 2 }).default(sql`0`),
  planEndTime: timestamp('plan_end_time'),
  role: userRoleEnum('role').notNull().default('USER'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  profile: json('profile'),
}, (table) => {
    return [
        // 单列索引
        index('user_status_idx').on(table.status),
        index('user_created_idx').on(table.createdAt),

        // 联合索引，直接在 on() 里传多个字段
        index('user_plan_time_idx').on(table.plan, table.planEndTime)
    ]
});
