import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { getDb } from '../db'
import { ApiResponse } from '../core/response'
import type { AppVariables } from '../types/hono'
import { NotFoundException } from '../core/exceptions'

const idSchema = z.object({ id: z.coerce.number().int().positive() })

export const createAdminResourceRoute = (
  service: {
    listForAdmin(db: ReturnType<typeof getDb>, filters?: Record<string, unknown>): Promise<unknown>
    get(userId: number, id: number): Promise<unknown>
    update?(userId: number, id: number, data: Record<string, unknown>): Promise<unknown>
    softDelete?(userId: number, id: number): Promise<unknown>
  },
  updateSchema?: z.ZodTypeAny,
) => {
  const app = new Hono<{ Variables: AppVariables }>()

  const findAdminRecord = async (id: number) => {
    const record = await service.listForAdmin(getDb(), { id }).then((records) => (records as any[])[0])

    if (!record) {
      throw new NotFoundException('resource not found', 'RESOURCE_NOT_FOUND')
    }

    return record
  }

  app.get('/', async (c) => c.json(ApiResponse.success(await service.listForAdmin(getDb(), c.req.query()))))

  app.get('/:id', zValidator('param', idSchema), async (c) => {
    const { id } = c.req.valid('param')

    return c.json(ApiResponse.success(await findAdminRecord(id)))
  })

  if (service.update && updateSchema) {
    app.patch('/:id', zValidator('param', idSchema), zValidator('json', updateSchema), async (c) => {
      const { id } = c.req.valid('param')
      const record = await findAdminRecord(id)
      const updated = await service.update((record as any).userId, id, c.req.valid('json'))

      return c.json(ApiResponse.success(updated))
    })
  }

  if (service.softDelete) {
    app.delete('/:id', zValidator('param', idSchema), async (c) => {
      const { id } = c.req.valid('param')
      const record = await findAdminRecord(id)
      await service.softDelete((record as any).userId, id)

      return c.json(ApiResponse.ok('deleted'))
    })
  }

  return app
}
