import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { AppVariables } from '../types/hono'
import { ApiResponse } from '../core/response'
import { authMiddleware } from '../middleware/auth.middleware'

const idSchema = z.object({ id: z.coerce.number().int().positive() })

export const createUserResourceRoute = (
  service: {
    list(userId: number): Promise<unknown>
    get(userId: number, id: number): Promise<unknown>
    create(userId: number, data: Record<string, unknown>): Promise<unknown>
    update(userId: number, id: number, data: Record<string, unknown>): Promise<unknown>
    softDelete(userId: number, id: number): Promise<unknown>
  },
  createSchema: z.ZodTypeAny,
  updateSchema: z.ZodTypeAny,
) => {
  const app = new Hono<{ Variables: AppVariables }>()
  app.use('*', authMiddleware())

  app.get('/', async (c) => c.json(ApiResponse.success(await service.list(c.get('currentUser').id))))
  app.get('/:id', zValidator('param', idSchema), async (c) => {
    return c.json(ApiResponse.success(await service.get(c.get('currentUser').id, c.req.valid('param').id)))
  })
  app.post('/', zValidator('json', createSchema), async (c) => {
    const record = await service.create(c.get('currentUser').id, c.req.valid('json'))
    return c.json(ApiResponse.success(record, 'created', 201), 201)
  })
  app.patch('/:id', zValidator('param', idSchema), zValidator('json', updateSchema), async (c) => {
    const record = await service.update(c.get('currentUser').id, c.req.valid('param').id, c.req.valid('json'))
    return c.json(ApiResponse.success(record))
  })
  app.delete('/:id', zValidator('param', idSchema), async (c) => {
    await service.softDelete(c.get('currentUser').id, c.req.valid('param').id)
    return c.json(ApiResponse.ok('deleted'))
  })

  return app
}

export const createReadonlyUserResourceRoute = (
  service: {
    list(userId: number): Promise<unknown>
    get(userId: number, id: number): Promise<unknown>
  },
) => {
  const app = new Hono<{ Variables: AppVariables }>()
  app.use('*', authMiddleware())

  app.get('/', async (c) => c.json(ApiResponse.success(await service.list(c.get('currentUser').id))))
  app.get('/:id', zValidator('param', idSchema), async (c) => {
    return c.json(ApiResponse.success(await service.get(c.get('currentUser').id, c.req.valid('param').id)))
  })

  return app
}
