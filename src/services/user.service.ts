import { getDb } from '../db';
import { BusinessException, NotFoundException } from '../core/exceptions';
import type { z } from 'zod';
import type { registerUserSchema } from '../routes/user.route';
import { hashPassword } from '../utils/password';

// 推导出注册的数据类型
type RegisterDTO = z.infer<typeof registerUserSchema>;

export const UserService = {
    async register(data: RegisterDTO) {
        const db = getDb();

        const existingUser = await db.user.findFirst({
            where: {
                OR: [
                    { username: data.username },
                    ...(data.email ? [{ email: data.email }] : []),
                ],
            },
        });

        if (existingUser) {
            throw new BusinessException(
                '用户名或邮箱已被注册',
                409,
                'USER_EXISTS',
            );
        }

        // 密码哈希
        const hashedPassword = await hashPassword(data.password);
        // 存入数据库
        const result = await db.user.create({
            data: {
                username: data.username,
                nickname: data.nickname,
                password: hashedPassword,
                email: data.email,
                phone: data.phone,
            },
            select: {
                id: true,
                username: true,
                nickname: true,
                plan: true,
                createdAt: true,
            },
        });
        return result;
    },

    async getUserByusername(username: string) {
        const db = getDb();

        const user = await db.user.findUnique({
            where: { username },
            select: {
                id: true,
                avatar: true,
                username: true,
                nickname: true,
                email: true,
                phone: true,
                status: true,
                plan: true,
                balance: true,
                planEndTime: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                profile: true,
            },
        })

        if(!user) {
            throw new NotFoundException(`找不到用户名为 ${username} 的用户`)
        }
        return user
    },
};
