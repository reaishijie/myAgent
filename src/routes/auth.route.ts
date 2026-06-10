import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppVariables } from '../types/hono'
import { ApiResponse } from '../core/response'
import { AuthService } from '../services/auth.service'
import { authMiddleware } from '../middleware/auth.middleware'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  deviceId: z.string().max(100).optional(),
  deviceName: z.string().max(100).optional(),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

const revokeSessionSchema = z.object({
  sessionId: z.number().int().positive(),
})

const authApp = new Hono<{ Variables: AppVariables }>()

authApp.post('/login', zValidator('json', loginSchema), async (c) => {
  const data = c.req.valid('json')
  const result = await AuthService.login({
    ...data,
    userAgent: c.req.header('user-agent'),
    ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for'),
  })

  return c.json(ApiResponse.success(result))
})

authApp.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const data = c.req.valid('json')
  const result = await AuthService.refresh(data.refreshToken)

  return c.json(ApiResponse.success(result))
})

authApp.post('/logout', zValidator('json', refreshSchema), async (c) => {
  const data = c.req.valid('json')
  await AuthService.logout(data.refreshToken)

  return c.json(ApiResponse.ok('logout success'))
})

authApp.get('/sessions', authMiddleware(), async (c) => {
  const currentUser = c.get('currentUser')
  const sessions = await AuthService.listSessions(currentUser.id)

  return c.json(ApiResponse.success(sessions))
})

authApp.post('/sessions/revoke', authMiddleware(), zValidator('json', revokeSessionSchema), async (c) => {
  const currentUser = c.get('currentUser')
  const data = c.req.valid('json')

  await AuthService.revokeSession(currentUser.id, data.sessionId)

  return c.json(ApiResponse.ok('session revoked'))
})

export default authApp
