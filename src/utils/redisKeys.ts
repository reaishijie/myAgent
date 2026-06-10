const prefix = 'myagent'

const joinKey = (...parts: Array<string | number>) => [prefix, ...parts].join(':')

export const redisKeys = {
  session: (sessionId: number | string) => joinKey('session', sessionId),
  tokenBlacklist: (tokenHash: string) => joinKey('token', 'blacklist', tokenHash),
  rateLimit: (scope: string, identity: string) => joinKey('rate-limit', scope, identity),
  config: (group: string) => joinKey('config', group),
}
