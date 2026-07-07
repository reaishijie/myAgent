import { expect, test } from 'bun:test'

test('worker module imports without DATABASE_URL at module load time', async () => {
  const originalDatabaseUrl = process.env.DATABASE_URL
  delete process.env.DATABASE_URL

  try {
    const worker = await import('./worker')

    expect(worker.default.fetch).toBeFunction()
  } finally {
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl
    }
  }
})
