import { describe, expect, test } from 'bun:test'
import { createAuthService } from './auth.service'

const createUser = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  username: 'alice',
  password: 'hashed-password',
  role: 'USER',
  status: 'NORMAL',
  ...overrides,
})

const createFakeDb = () => {
  const state = {
    user: createUser(),
    sessions: [] as any[],
  }

  const db = {
    user: {
      findFirst: async () => state.user,
    },
    userSession: {
      create: async ({ data }: any) => {
        const session = { id: state.sessions.length + 1, status: 'ACTIVE', createdAt: new Date(), ...data }
        state.sessions.push(session)
        return session
      },
      findUnique: async ({ where }: any) =>
        state.sessions.find((session) => session.refreshTokenHash === where.refreshTokenHash) ?? null,
      update: async ({ where, data }: any) => {
        const session = state.sessions.find((item) => item.id === where.id)
        Object.assign(session, data)
        return session
      },
      findMany: async ({ where, orderBy }: any = {}) => {
        let sessions = state.sessions.filter((session) => {
          if (!where) {
            return true
          }

          return Object.entries(where).every(([key, value]) => session[key] === value)
        })

        if (orderBy?.createdAt === 'desc') {
          sessions = [...sessions].sort((a, b) => {
            const left = a.createdAt?.getTime?.() ?? a.id
            const right = b.createdAt?.getTime?.() ?? b.id
            return right - left
          })
        }

        return sessions
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0
        for (const session of state.sessions) {
          const matches =
            session.userId === where.userId &&
            session.status === where.status &&
            (!where.id?.in || where.id.in.includes(session.id))

          if (matches) {
            Object.assign(session, data)
            count += 1
          }
        }
        return { count }
      },
    },
  }

  return { db, state }
}

describe('AuthService', () => {
  test('login creates a user session and returns access and refresh tokens', async () => {
    const { db, state } = createFakeDb()
    const service = createAuthService({
      db: db as any,
      verifyPassword: async () => true,
      tokenManager: {
        signAccessToken: async () => 'access-token',
        createRefreshToken: async () => ({ token: 'refresh-token', hash: 'refresh-hash' }),
      } as any,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    })

    const result = await service.login({
      username: 'alice',
      password: 'secret',
      deviceId: 'web-1',
      deviceName: 'Chrome',
    })

    expect(result.accessToken).toBe('access-token')
    expect(result.refreshToken).toBe('refresh-token')
    expect(state.sessions).toHaveLength(1)
    expect(state.sessions[0].refreshTokenHash).toBe('refresh-hash')
    expect(state.sessions[0].deviceId).toBe('web-1')
  })

  test('refresh rejects a revoked session', async () => {
    const { db, state } = createFakeDb()
    state.sessions.push({
      id: 1,
      userId: 1,
      refreshTokenHash: 'old-hash',
      status: 'REVOKED',
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      user: state.user,
    })
    const service = createAuthService({
      db: db as any,
      verifyPassword: async () => true,
      tokenManager: {
        signAccessToken: async () => 'access-token',
        hashRefreshToken: async () => 'old-hash',
        createRefreshToken: async () => ({ token: 'new-refresh-token', hash: 'new-hash' }),
      } as any,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    })

    await expect(service.refresh('refresh-token')).rejects.toThrow('Refresh token is invalid')
  })

  test('logout revokes the matching refresh token session', async () => {
    const { db, state } = createFakeDb()
    state.sessions.push({
      id: 1,
      userId: 1,
      refreshTokenHash: 'refresh-hash',
      status: 'ACTIVE',
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      user: state.user,
    })
    const service = createAuthService({
      db: db as any,
      verifyPassword: async () => true,
      tokenManager: {
        hashRefreshToken: async () => 'refresh-hash',
      } as any,
      now: () => new Date('2026-01-01T00:00:00.000Z'),
    })

    await service.logout('refresh-token')

    expect(state.sessions[0].status).toBe('REVOKED')
    expect(state.sessions[0].revokedAt).toEqual(new Date('2026-01-01T00:00:00.000Z'))
  })

  test('login revokes oldest active sessions when device limit is exceeded', async () => {
    const { db, state } = createFakeDb()
    state.sessions.push(
      { id: 1, userId: 1, status: 'ACTIVE', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 2, userId: 1, status: 'ACTIVE', createdAt: new Date('2026-01-02T00:00:00.000Z') },
    )
    const service = createAuthService({
      db: db as any,
      verifyPassword: async () => true,
      tokenManager: {
        signAccessToken: async () => 'access-token',
        createRefreshToken: async () => ({ token: 'refresh-token', hash: 'refresh-hash' }),
      } as any,
      now: () => new Date('2026-01-03T00:00:00.000Z'),
      maxActiveSessions: 2,
    })

    await service.login({ username: 'alice', password: 'secret' })

    expect(state.sessions.map((session) => session.status)).toEqual(['REVOKED', 'ACTIVE', 'ACTIVE'])
    expect(state.sessions[0].revokedAt).toEqual(new Date('2026-01-03T00:00:00.000Z'))
  })
})
