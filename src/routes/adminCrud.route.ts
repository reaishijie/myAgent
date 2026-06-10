import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppVariables } from '../types/hono'
import { ApiResponse } from '../core/response'

const idSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const createAdminCrudRoute = (
  service: {
    list(filters?: Record<string, unknown>): Promise<unknown>
    get(id: number): Promise<unknown>
    create(data: Record<string, unknown>): Promise<unknown>
    update(id: number, data: Record<string, unknown>): Promise<unknown>
    softDelete(id: number): Promise<unknown>
  },
  createSchema: z.ZodTypeAny,
  updateSchema: z.ZodTypeAny,
) => {
  const app = new Hono<{ Variables: AppVariables }>()

  app.get('/', async (c) => c.json(ApiResponse.success(await service.list(c.req.query()))))

  app.get('/:id', zValidator('param', idSchema), async (c) => {
    const { id } = c.req.valid('param')

    return c.json(ApiResponse.success(await service.get(id)))
  })

  app.post('/', zValidator('json', createSchema), async (c) => {
    const record = await service.create(c.req.valid('json'))

    return c.json(ApiResponse.success(record, 'created', 201), 201)
  })

  app.patch('/:id', zValidator('param', idSchema), zValidator('json', updateSchema), async (c) => {
    const { id } = c.req.valid('param')
    const record = await service.update(id, c.req.valid('json'))

    return c.json(ApiResponse.success(record))
  })

  app.delete('/:id', zValidator('param', idSchema), async (c) => {
    const { id } = c.req.valid('param')
    await service.softDelete(id)

    return c.json(ApiResponse.ok('deleted'))
  })

  return app
}
