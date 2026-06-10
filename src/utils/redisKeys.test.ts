import { expect, test } from 'bun:test'
import { redisKeys } from './redisKeys'

test('redisKeys uses the myagent prefix for reserved auth and rate limit keys', () => {
  expect(redisKeys.session(12)).toBe('myagent:session:12')
  expect(redisKeys.tokenBlacklist('abc')).toBe('myagent:token:blacklist:abc')
  expect(redisKeys.rateLimit('login', '127.0.0.1')).toBe('myagent:rate-limit:login:127.0.0.1')
  expect(redisKeys.config('site')).toBe('myagent:config:site')
})
