import { describe, expect, test } from 'bun:test'
import { UnsupportedModelAdapter, createUnsupportedModelAdapter } from './index'

describe('model adapter boundary', () => {
  test('unsupported adapter exposes protocol and rejects calls with a stable code', async () => {
    const adapter = createUnsupportedModelAdapter('CUSTOM')

    expect(adapter.protocol).toBe('CUSTOM')
    await expect(adapter.invoke({} as any)).rejects.toThrow(UnsupportedModelAdapter)
    await expect(adapter.invoke({} as any)).rejects.toHaveProperty('code', 'MODEL_ADAPTER_UNSUPPORTED')
  })
})
