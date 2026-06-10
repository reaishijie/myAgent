import type { ChannelProtocol, ModelCapability } from '@prisma/client'

export interface ModelAdapterRequest {
  model: string
  capability: ModelCapability
  payload: unknown
}

export interface ModelAdapterResponse {
  response: unknown
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface ModelAdapter {
  protocol: ChannelProtocol
  invoke(request: ModelAdapterRequest): Promise<ModelAdapterResponse>
}

export class UnsupportedModelAdapter extends Error {
  code = 'MODEL_ADAPTER_UNSUPPORTED'

  constructor(protocol: ChannelProtocol) {
    super(`Model adapter is not implemented for protocol ${protocol}`)
    this.name = 'UnsupportedModelAdapter'
  }
}

export const createUnsupportedModelAdapter = (protocol: ChannelProtocol): ModelAdapter => ({
  protocol,
  async invoke() {
    throw new UnsupportedModelAdapter(protocol)
  },
})

