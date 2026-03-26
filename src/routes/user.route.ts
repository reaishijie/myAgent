import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

import { Logger } from '../utils/logger';
import { UserService } from '../services/user.service';
import { ApiResponse } from '../core/response';

// 定义入参规则（Zod Schema）
export const registerUserSchema = z.object({
    username: z
        .string()
        .min(3, '用户名至少需要3个字符')
        .max(30, '用户名太长啦'),
    password: z.string().min(6, '密码至少6位').max(20, '密码太长啦'),
    phone: z
        .string()
        .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
        .optional(),
    email: z.email('邮箱格式不正确').optional(),
    nickname: z.string().max(30).optional(),
});

const userApp = new Hono();
const logger = new Logger('UserController');
// 注册
userApp.post('/register', zValidator('json', registerUserSchema), async (c) => {
    const data = c.req.valid('json');
    logger.log(`收到新用户注册请求： ${data.username}`);
    const newUser = await UserService.register(data);

    return c.json(ApiResponse.success(newUser, '注册成功', 201), 201);
});

// 根据用户名查询用户
userApp.get('/:username', async (c) => {
    const username = c.req.param('username')

    const user = await UserService.getUserByusername(username)
    return c.json(ApiResponse.success(user))
});

export default userApp
