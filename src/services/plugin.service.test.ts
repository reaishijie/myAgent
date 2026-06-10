import { describe, expect, test } from 'bun:test'
import { createPluginService } from './plugin.service'

describe('PluginService', () => {
  test('lists non-deleted plugins with query filters', async () => {
    const calls: any[] = []
    const db = {
      plugin: {
        findMany: async (args: any) => {
          calls.push(args)
          return []
        },
        findFirst: async () => null,
        create: async ({ data }: any) => ({ id: 1, ...data }),
        update: async ({ where, data }: any) => ({ ...where, ...data }),
      },
    }
    const service = createPluginService(() => (db as any).plugin)

    await service.list({ status: 'ENABLED', authType: 'API_KEY' })

    expect(calls[0]).toEqual({
      where: {
        deletedAt: null,
        status: 'ENABLED',
        authType: 'API_KEY',
      },
      orderBy: { id: 'desc' },
    })
  })
})
