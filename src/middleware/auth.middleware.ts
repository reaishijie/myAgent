import type { MiddlewareHandler } from 'hono'
import { UserRole } from '@prisma/client'
import type { AppVariables } from '../types/hono'
import { ForbiddenException, UnauthorizedException } from '../core/exceptions'
import { createTokenManager } from '../utils/token'

export const authMiddleware = (): MiddlewareHandler<{ Variables: AppVariables }> => {
  const tokenManager = createTokenManager()

  return async (c, next) => {
    const authorization = c.req.header('authorization')
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined

    if (!token) {
      throw new UnauthorizedException('Access token is required', 'ACCESS_TOKEN_REQUIRED')
    }

    try {
      const payload = await tokenManager.verifyAccessToken(token)
      c.set('currentUser', {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
        sessionId: payload.sessionId,
      })
    } catch {
      throw new UnauthorizedException('Access token is invalid', 'INVALID_ACCESS_TOKEN')
    }

    await next()
  }
}

export const adminMiddleware = (): MiddlewareHandler<{ Variables: AppVariables }> => {
  return async (c, next) => {
    const currentUser = c.get('currentUser')

    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin permission is required', 'ADMIN_REQUIRED')
    }

    await next()
  }
}
