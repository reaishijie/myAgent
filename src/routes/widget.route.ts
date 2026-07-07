import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { ApiResponse } from '../core/response'
import { WidgetService } from '../services/widget.service'

const widgetIdParamSchema = z.object({
  widgetId: z.string().trim().min(1),
})

const widgetApp = new Hono()

widgetApp.get('/:widgetId/config', zValidator('param', widgetIdParamSchema), async (c) => {
  const { widgetId } = c.req.valid('param')
  const result = await WidgetService.getPublicConfig(widgetId)

  return c.json(ApiResponse.success(result))
})

export default widgetApp
