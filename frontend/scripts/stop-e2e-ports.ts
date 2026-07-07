const ports = [4011, 9898, 5174]

for (const port of ports) {
  const proc = Bun.spawnSync(['bash', '-lc', `lsof -tiTCP:${port} -sTCP:LISTEN | xargs -r kill`], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  if (!proc.success) {
    const stderr = new TextDecoder().decode(proc.stderr).trim()
    if (stderr) {
      console.warn(stderr)
    }
  }
}
