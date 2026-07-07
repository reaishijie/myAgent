import { createServer } from 'node:net'

const rootDir = new URL('../..', import.meta.url).pathname
const frontendDir = new URL('..', import.meta.url).pathname
const localLibraryPath = '/tmp/playwright-libs/extracted/usr/lib/x86_64-linux-gnu'

const getFreePort = () => new Promise<number>((resolve, reject) => {
  const server = createServer()
  server.unref()
  server.on('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') {
      server.close(() => reject(new Error('Failed to allocate a TCP port')))
      return
    }
    const { port } = address
    server.close(() => resolve(port))
  })
})

const getUniquePorts = async (count: number) => {
  const ports = new Set<number>()

  while (ports.size < count) {
    ports.add(await getFreePort())
  }

  return [...ports]
}

const [mockPort, backendPort, frontendPort] = await getUniquePorts(3)

const mockBaseUrl = `http://127.0.0.1:${mockPort}`
const backendBaseUrl = `http://127.0.0.1:${backendPort}`
const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`

const baseEnv = {
  ...process.env,
  LD_LIBRARY_PATH: [localLibraryPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
  NO_PROXY: '127.0.0.1,localhost',
  no_proxy: '127.0.0.1,localhost',
}

const backendEnv = {
  ...baseEnv,
  HOST: '127.0.0.1',
  PORT: String(backendPort),
  DATABASE_URL: 'postgres://postgres:123456@localhost:5432/agent-rag',
  ADMIN_API_KEY: 'playwright-admin-key',
  OPENAI_CHAT_API_KEY: 'mock-key',
  OPENAI_CHAT_BASE_URL: `${mockBaseUrl}/v1`,
  OPENAI_CHAT_MODEL: 'mock-chat',
  OPENAI_EMBEDDING_API_KEY: 'mock-key',
  OPENAI_EMBEDDING_BASE_URL: `${mockBaseUrl}/v1`,
  OPENAI_EMBEDDING_MODEL: 'mock-embedding',
}

const playwrightEnv = {
  ...baseEnv,
  E2E_API_BASE_URL: `${backendBaseUrl}/api`,
  E2E_FRONTEND_URL: frontendBaseUrl,
}

const run = (label: string, command: string[], options: { cwd?: string; env?: Record<string, string | undefined> } = {}) => {
  const process = Bun.spawn(command, {
    cwd: options.cwd,
    env: options.env,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  return { label, process, exited: false, exitCode: null as number | null }
}

const waitFor = async (url: string, label: string, service: ReturnType<typeof run>) => {
  const deadline = Date.now() + 45_000
  let lastError = ''
  let consecutiveSuccesses = 0

  while (Date.now() < deadline) {
    if (service.exited) {
      throw new Error(`${label} exited before becoming ready with code ${service.exitCode}`)
    }

    try {
      const response = await fetch(url)
      if (response.ok) {
        consecutiveSuccesses += 1
        if (consecutiveSuccesses >= 3) return
      } else {
        consecutiveSuccesses = 0
        lastError = `${response.status} ${response.statusText}`
      }
    } catch (error) {
      consecutiveSuccesses = 0
      lastError = error instanceof Error ? error.message : String(error)
    }
    await Bun.sleep(300)
  }

  throw new Error(`${label} did not become ready at ${url}: ${lastError}`)
}

const services = [
  run('mock provider', ['bun', 'scripts/mock-openai-provider.ts'], {
    cwd: rootDir,
    env: { ...baseEnv, MOCK_OPENAI_PORT: String(mockPort) },
  }),
  run('backend', ['bun', 'src/index.ts'], { cwd: rootDir, env: backendEnv }),
  run('frontend', ['bun', './node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(frontendPort), '--strictPort'], {
    cwd: frontendDir,
    env: baseEnv,
  }),
]

for (const service of services) {
  service.process.exited.then((code) => {
    service.exited = true
    service.exitCode = code
  })
}

let exitCode = 0

try {
  await waitFor(`${mockBaseUrl}/`, 'mock provider', services[0])
  await waitFor(`${backendBaseUrl}/`, 'backend', services[1])
  await waitFor(`${frontendBaseUrl}/`, 'frontend', services[2])

  const earlyExit = services.find((service) => service.exited)
  if (earlyExit) {
    throw new Error(`${earlyExit.label} exited before Playwright started with code ${earlyExit.exitCode}`)
  }

  const result = Bun.spawnSync(['playwright', 'test'], {
    cwd: frontendDir,
    env: playwrightEnv,
    stdout: 'inherit',
    stderr: 'inherit',
  })

  if (!result.success) {
    exitCode = result.exitCode || 1
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  exitCode = 1
} finally {
  await Bun.sleep(500)
  for (const service of services) {
    if (!service.exited) {
      service.process.kill()
    }
  }
  await Promise.allSettled(services.map((service) => service.process.exited))
}

process.exit(exitCode)
