export interface CacheClient {
  available: boolean
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
}

const noopCacheClient: CacheClient = {
  available: false,
  async get() {
    return null
  },
  async set() {},
  async del() {},
}

let cacheClient: CacheClient | undefined

export const getRedis = () => {
  if (!cacheClient) {
    cacheClient = noopCacheClient
  }

  return cacheClient
}

export const setRedisClientForRuntime = (client: CacheClient) => {
  cacheClient = client
}
