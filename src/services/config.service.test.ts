import { describe, expect, test } from 'bun:test'
import { ConfigService } from './config.service'

const configs = [
  { id: 1, key: 'site.name', value: 'MyAgent', group: 'site', accessLevel: 'PUBLIC', status: 'ENABLED', deletedAt: null },
  { id: 2, key: 'feature.chat.enabled', value: true, group: 'feature', accessLevel: 'AUTHENTICATED', status: 'ENABLED', deletedAt: null },
  { id: 3, key: 'oss.endpoint', value: 'https://oss.example.com', group: 'oss', accessLevel: 'ADMIN', status: 'ENABLED', deletedAt: null },
]

describe('ConfigService', () => {
  test('public reads only PUBLIC enabled configs', async () => {
    const db = {
      config: {
        findMany: async ({ where }: any) =>
          configs.filter((config) =>
            where.accessLevel.in.includes(config.accessLevel) &&
            config.status === where.status &&
            config.deletedAt === where.deletedAt,
          ),
      },
    }

    const result = await ConfigService.listReadable(db as any, 'PUBLIC')

    expect(result.map((item) => item.key)).toEqual(['site.name'])
  })

  test('admin reads PUBLIC, AUTHENTICATED and ADMIN configs', async () => {
    const db = {
      config: {
        findMany: async ({ where }: any) =>
          configs.filter((config) => where.accessLevel.in.includes(config.accessLevel)),
      },
    }

    const result = await ConfigService.listReadable(db as any, 'ADMIN')

    expect(result.map((item) => item.key)).toEqual(['site.name', 'feature.chat.enabled', 'oss.endpoint'])
  })
})
