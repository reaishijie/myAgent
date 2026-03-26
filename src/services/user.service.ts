import { eq, or } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { BusinessException, NotFoundException } from '../core/exceptions';
import type { z } from 'zod';
import type { registerUserSchema } from '../routes/user.route';

// 推导出注册的数据类型
type RegisterDTO = z.infer<typeof registerUserSchema>;

export const UserService = {
    async register(data: RegisterDTO) {
        const existingUser = await db.query.users.findFirst({
            where: or(
                eq(users.username, data.username),
                data.email ? eq(users.email, data.email) : undefined,
            ),
        });

        if (existingUser) {
            throw new BusinessException(
                '用户名或邮箱已被注册',
                409,
                'USER_EXISTS',
            );
        }

        // 密码哈希
        const hashedPassword = await Bun.password.hash(data.password, {
            algorithm: 'bcrypt',
            cost: 10,
        });
        // 存入数据库
        const result = await db
            .insert(users)
            .values({
                username: data.username,
                nickname: data.nickname,
                password: hashedPassword,
                email: data.email,
                phone: data.phone,
            })
            .returning({
                id: users.id,
                username: users.username,
                nickname: users.nickname,
                plan: users.plan,
                createdAt: users.createdAt,
            });
        return result[0];
    },

    async getUserByusername(username: string) {
        const user = await db.query.users.findFirst({
            where: eq(users.username, username),
            columns: {
                password: false
            }
        })

        if(!user) {
            throw new NotFoundException(`找不到用户名为 ${username} 的用户`)
        }
        return user
    },
};
