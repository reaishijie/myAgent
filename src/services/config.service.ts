import { ConfigAccessLevel, RecordStatus, type PrismaClient } from '@prisma/client'
import { getDb } from '../db'
import { createCrudService } from './crud.service'

type ConfigDb = Pick<PrismaClient, 'config'>

const readableLevels = {
  PUBLIC: [ConfigAccessLevel.PUBLIC],
  AUTHENTICATED: [ConfigAccessLevel.PUBLIC, ConfigAccessLevel.AUTHENTICATED],
  ADMIN: [ConfigAccessLevel.PUBLIC, ConfigAccessLevel.AUTHENTICATED, ConfigAccessLevel.ADMIN],
} satisfies Record<ConfigAccessLevel, ConfigAccessLevel[]>

export const ConfigService = {
  admin: createCrudService(() => getDb().config, 'config'),

  listReadable(db: ConfigDb, level: ConfigAccessLevel, group?: string) {
    return db.config.findMany({
      where: {
        accessLevel: { in: readableLevels[level] },
        status: RecordStatus.ENABLED,
        deletedAt: null,
        ...(group ? { group } : {}),
      },
      orderBy: { key: 'asc' },
    })
  },

  listPublic(group?: string) {
    return this.listReadable(getDb(), ConfigAccessLevel.PUBLIC, group)
  },

  listForUser(level: ConfigAccessLevel, group?: string) {
    return this.listReadable(getDb(), level, group)
  },
}
