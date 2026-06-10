import { getDb } from '../db'
import { encryptSecret, decryptSecret } from '../utils/cryptoSecret'
import { maskSecret } from '../utils/maskSecret'
import { createCrudService } from './crud.service'
import { createdAtRange, pickFilters, type ResourceFilters } from './queryFilters'

const sanitizeChannel = async (channel: any) => {
  const apiKey = await decryptSecret(channel.apiKeyEncrypted).catch(() => '')
  const { apiKeyEncrypted, ...rest } = channel

  return {
    ...rest,
    apiKeyMasked: maskSecret(apiKey),
  }
}

export const ModelChannelService = {
  base: createCrudService(() => getDb().modelChannel, 'model channel'),

  async list(filters: ResourceFilters = {}) {
    const channels = await this.base.list({
      ...pickFilters(filters, ['id', 'provider', 'protocol', 'status']),
      ...createdAtRange(filters),
    })
    return Promise.all(channels.map(sanitizeChannel))
  },

  async get(id: number) {
    return sanitizeChannel(await this.base.get(id))
  },

  async create(data: Record<string, any>) {
    const { apiKey, ...rest } = data
    const created = await this.base.create({
      ...rest,
      apiKeyEncrypted: await encryptSecret(apiKey),
    })

    return sanitizeChannel(created)
  },

  async update(id: number, data: Record<string, any>) {
    const { apiKey, ...rest } = data
    const updated = await this.base.update(id, {
      ...rest,
      ...(apiKey ? { apiKeyEncrypted: await encryptSecret(apiKey) } : {}),
    })

    return sanitizeChannel(updated)
  },

  softDelete(id: number) {
    return this.base.softDelete(id)
  },
}
