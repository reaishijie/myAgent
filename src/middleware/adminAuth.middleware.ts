import type { MiddlewareHandler } from 'hono'
import { ForbiddenException, UnauthorizedException } from '../core/exceptions'

const readAdminToken = (headers: Headers) => {
  const apiKey = headers.get('x-admin-api-key')?.trim()
  if (apiKey) {
    return apiKey
  }

  const authorization = headers.get('authorization')?.trim()
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }

  return null
}

export const assertAdminApiKey = (headers: Headers) => {
  const expectedToken = process.env.ADMIN_API_KEY?.trim()

  if (!expectedToken) {
    throw new ForbiddenException('后台口令未配置', 'ADMIN_API_KEY_NOT_CONFIGURED')
  }

  const token = readAdminToken(headers)
  if (!token) {
    throw new UnauthorizedException('缺少后台口令', 'ADMIN_API_KEY_REQUIRED')
  }

  if (token !== expectedToken) {
    throw new ForbiddenException('后台口令无效', 'ADMIN_API_KEY_INVALID')
  }
}

export const requireAdminApiKey = (): MiddlewareHandler => {
  return async (c, next) => {
    assertAdminApiKey(c.req.raw.headers)
    await next()
  }
}
