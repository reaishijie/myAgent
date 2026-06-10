import { describe, expect, test } from 'bun:test'
import { ModelInvocationService } from './modelInvocation.service'

describe('ModelInvocationService', () => {
  test('create records an invocation and creates a pending billing record when cost exists', async () => {
    const billingRecords: any[] = []
    const db = {
      modelInvocation: {
        create: async ({ data }: any) => ({ id: 20, ...data }),
      },
      billingRecord: {
        create: async ({ data }: any) => {
          billingRecords.push(data)
          return { id: 30, ...data }
        },
      },
    }

    const invocation = await ModelInvocationService.create(db as any, 1, {
      modelId: 2,
      channelId: 3,
      capability: 'CHAT',
      status: 'SUCCESS',
      totalTokens: 22,
      cost: '0.001',
    })

    expect(invocation.id).toBe(20)
    expect(billingRecords).toEqual([
      {
        userId: 1,
        modelInvocationId: 20,
        modelId: 2,
        channelId: 3,
        capability: 'CHAT',
        amount: '0.001',
        status: 'PENDING',
        detail: { totalTokens: 22 },
      },
    ])
  })
})
