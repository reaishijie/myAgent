import type { UserRole } from '@prisma/client'

const encoder = new TextEncoder()

const base64UrlEncode = (value: string | Uint8Array) => {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value
  return Buffer.from(bytes)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

const base64UrlDecode = (value: string) => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return Buffer.from(padded, 'base64').toString('utf8')
}

const createHmac = async (content: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(content))
  return base64UrlEncode(new Uint8Array(signature))
}

export interface AccessTokenPayload {
  sub: number
  username: string
  role: UserRole
  sessionId: number
  exp: number
}

export interface TokenManager {
  signAccessToken(payload: Omit<AccessTokenPayload, 'exp'>): Promise<string>
  verifyAccessToken(token: string): Promise<AccessTokenPayload>
  createRefreshToken(): Promise<{ token: string; hash: string }>
  hashRefreshToken(token: string): Promise<string>
}

export const createTokenManager = (options: {
  secret?: string
  accessTokenTtlSeconds?: number
  now?: () => Date
} = {}): TokenManager => {
  const secret = options.secret || process.env.JWT_SECRET || 'myagent-local-secret'
  const ttl = options.accessTokenTtlSeconds ?? 60 * 15
  const now = options.now ?? (() => new Date())

  return {
    async signAccessToken(payload) {
      const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const body = base64UrlEncode(JSON.stringify({
        ...payload,
        exp: Math.floor(now().getTime() / 1000) + ttl,
      }))
      const content = `${header}.${body}`
      const signature = await createHmac(content, secret)

      return `${content}.${signature}`
    },

    async verifyAccessToken(token) {
      const [header, body, signature] = token.split('.')
      if (!header || !body || !signature) {
        throw new Error('Invalid token')
      }

      const expected = await createHmac(`${header}.${body}`, secret)
      if (signature !== expected) {
        throw new Error('Invalid token')
      }

      const payload = JSON.parse(base64UrlDecode(body)) as AccessTokenPayload
      if (payload.exp <= Math.floor(now().getTime() / 1000)) {
        throw new Error('Token expired')
      }

      return payload
    },

    async createRefreshToken() {
      const bytes = new Uint8Array(48)
      crypto.getRandomValues(bytes)
      const token = base64UrlEncode(bytes)
      const hash = await this.hashRefreshToken(token)

      return { token, hash }
    },

    async hashRefreshToken(token) {
      const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))
      return base64UrlEncode(new Uint8Array(digest))
    },
  }
}
