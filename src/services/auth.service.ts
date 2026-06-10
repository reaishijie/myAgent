import type { PrismaClient, User, UserSession } from '@prisma/client'
import { UserRole, UserSessionStatus, UserStatus } from '@prisma/client'
import { getDb } from '../db'
import { BadRequestException, UnauthorizedException } from '../core/exceptions'
import { verifyPassword as defaultVerifyPassword } from '../utils/password'
import { createTokenManager, type TokenManager } from '../utils/token'

const REFRESH_TOKEN_TTL_DAYS = 30

export interface LoginDTO {
  username: string
  password: string
  deviceId?: string
  deviceName?: string
  userAgent?: string
  ipAddress?: string
}

export interface AuthUser {
  id: number
  username: string
  role: UserRole
  sessionId: number
}

type AuthDb = Pick<PrismaClient, 'user' | 'userSession'>

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000)

const toAuthUser = (user: Pick<User, 'id' | 'username' | 'role'>, sessionId: number): AuthUser => ({
  id: user.id,
  username: user.username,
  role: user.role,
  sessionId,
})

export const createAuthService = (deps: {
  db?: AuthDb
  verifyPassword?: (password: string, hash: string) => Promise<boolean>
  tokenManager?: TokenManager
  now?: () => Date
} = {}) => {
  const getDbClient = () => deps.db ?? getDb()
  const verifyPassword = deps.verifyPassword ?? defaultVerifyPassword
  const tokenManager = deps.tokenManager ?? createTokenManager()
  const now = deps.now ?? (() => new Date())

  const createTokenPair = async (user: Pick<User, 'id' | 'username' | 'role'>, session: UserSession) => {
    const authUser = toAuthUser(user, session.id)
    const accessToken = await tokenManager.signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      sessionId: session.id,
    })

    return { accessToken, authUser }
  }

  return {
    async login(data: LoginDTO) {
      const db = getDbClient()
      const user = await db.user.findFirst({
        where: {
          username: data.username,
          status: UserStatus.NORMAL,
        },
      })

      if (!user || !(await verifyPassword(data.password, user.password))) {
        throw new UnauthorizedException('Username or password is invalid', 'INVALID_CREDENTIALS')
      }

      const refreshToken = await tokenManager.createRefreshToken()
      const session = await db.userSession.create({
        data: {
          userId: user.id,
          refreshTokenHash: refreshToken.hash,
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          userAgent: data.userAgent,
          ipAddress: data.ipAddress,
          expiresAt: addDays(now(), REFRESH_TOKEN_TTL_DAYS),
          lastSeenAt: now(),
        },
      })
      const tokenPair = await createTokenPair(user, session)

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: refreshToken.token,
        user: tokenPair.authUser,
      }
    },

    async refresh(refreshToken: string) {
      const db = getDbClient()
      const refreshTokenHash = await tokenManager.hashRefreshToken(refreshToken)
      const session = await db.userSession.findUnique({
        where: { refreshTokenHash },
        include: { user: true },
      })

      if (
        !session ||
        session.status !== UserSessionStatus.ACTIVE ||
        session.expiresAt <= now() ||
        session.user.status !== UserStatus.NORMAL
      ) {
        throw new UnauthorizedException('Refresh token is invalid', 'INVALID_REFRESH_TOKEN')
      }

      const nextRefreshToken = await tokenManager.createRefreshToken()
      const updatedSession = await db.userSession.update({
        where: { id: session.id },
        data: {
          refreshTokenHash: nextRefreshToken.hash,
          expiresAt: addDays(now(), REFRESH_TOKEN_TTL_DAYS),
          lastSeenAt: now(),
        },
      })
      const tokenPair = await createTokenPair(session.user, updatedSession)

      return {
        accessToken: tokenPair.accessToken,
        refreshToken: nextRefreshToken.token,
        user: tokenPair.authUser,
      }
    },

    async logout(refreshToken: string) {
      const db = getDbClient()
      const refreshTokenHash = await tokenManager.hashRefreshToken(refreshToken)
      const session = await db.userSession.findUnique({ where: { refreshTokenHash } })

      if (!session) {
        return null
      }

      return db.userSession.update({
        where: { id: session.id },
        data: {
          status: UserSessionStatus.REVOKED,
          revokedAt: now(),
        },
      })
    },

    async listSessions(userId: number) {
      const db = getDbClient()
      return db.userSession.findMany({
        where: {
          userId,
          status: UserSessionStatus.ACTIVE,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          deviceId: true,
          deviceName: true,
          userAgent: true,
          ipAddress: true,
          lastSeenAt: true,
          expiresAt: true,
          createdAt: true,
        },
      })
    },

    async revokeSession(userId: number, sessionId: number) {
      const db = getDbClient()
      const session = await db.userSession.findFirst({
        where: { id: sessionId, userId, status: UserSessionStatus.ACTIVE },
      })

      if (!session) {
        throw new BadRequestException('Session does not exist or is already revoked', 'SESSION_NOT_ACTIVE')
      }

      return db.userSession.update({
        where: { id: session.id },
        data: {
          status: UserSessionStatus.REVOKED,
          revokedAt: now(),
        },
      })
    },
  }
}

export const AuthService = createAuthService()
