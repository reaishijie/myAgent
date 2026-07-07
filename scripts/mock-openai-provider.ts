const port = Number(process.env.MOCK_OPENAI_PORT || 4011)

const embedding = Array.from({ length: 1536 }, (_, index) => (index % 13) / 13)

const json = (data: unknown) => new Response(JSON.stringify(data), {
  headers: { 'content-type': 'application/json' },
})

const stream = () => {
  const encoder = new TextEncoder()

  return new Response(new ReadableStream({
    start(controller) {
      for (const content of ['这是', '基于知识库片段的', '验收回答。']) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  }), {
    headers: { 'content-type': 'text/event-stream' },
  })
}

Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(request) {
    const url = new URL(request.url)

    if (url.pathname === '/') {
      return json({ status: 'ok' })
    }

    if (url.pathname === '/v1/embeddings') {
      const body = await request.json() as { input: string | string[]; model?: string }
      const inputs = Array.isArray(body.input) ? body.input : [body.input]

      return json({
        model: body.model || 'mock-embedding',
        data: inputs.map((_, index) => ({ index, embedding })),
        usage: { prompt_tokens: 1, total_tokens: 1 },
      })
    }

    if (url.pathname === '/v1/chat/completions') {
      const body = await request.json() as { stream?: boolean }
      if (body.stream) {
        return stream()
      }

      return json({
        choices: [{ message: { content: '这是基于知识库片段的验收回答。' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })
    }

    return new Response('not found', { status: 404 })
  },
})

console.log(`Mock OpenAI-compatible provider listening on http://127.0.0.1:${port}/v1`)
