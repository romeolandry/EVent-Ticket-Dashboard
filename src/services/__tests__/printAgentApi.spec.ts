import { describe, it, expect, vi, afterEach } from 'vitest'
import { pingPrintAgent, printBadgeOnQl800, PrintAgentError } from '@/services/printAgentApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
  return fetch as ReturnType<typeof vi.fn>
}

describe('services/printAgentApi — pingPrintAgent', () => {
  it('retourne l’état de l’agent quand /healthz répond', async () => {
    stubFetch(async () =>
      new Response(JSON.stringify({ ok: true, model: 'QL-800', label: '62', brotherQl: true }), {
        status: 200,
      }),
    )
    const status = await pingPrintAgent('http://127.0.0.1:9100')
    expect(status.model).toBe('QL-800')
    expect(status.brotherQl).toBe(true)
  })

  it('lève PrintAgentError « unreachable » si l’agent ne répond pas', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(pingPrintAgent('http://127.0.0.1:9100')).rejects.toMatchObject({
      name: 'PrintAgentError',
      code: 'unreachable',
    })
  })

  it('lève « unreachable » sur un statut HTTP d’erreur', async () => {
    stubFetch(async () => new Response('nope', { status: 500 }))
    await expect(pingPrintAgent('http://127.0.0.1:9100')).rejects.toMatchObject({
      code: 'unreachable',
    })
  })
})

describe('services/printAgentApi — printBadgeOnQl800', () => {
  it('POST le PNG en JSON vers /print', async () => {
    const fetchMock = stubFetch(async () => new Response('{}', { status: 200 }))
    await printBadgeOnQl800('http://127.0.0.1:9100/', 'data:image/png;base64,AAAA')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    // Slash final normalisé
    expect(url).toBe('http://127.0.0.1:9100/print')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ image: 'data:image/png;base64,AAAA' })
  })

  it('lève PrintAgentError « failed » avec le détail du serveur', async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ error: 'print_failed', detail: 'printer busy' }), {
          status: 502,
        }),
    )
    const promise = printBadgeOnQl800('http://127.0.0.1:9100', 'data:image/png;base64,AAAA')
    await expect(promise).rejects.toBeInstanceOf(PrintAgentError)
    await expect(promise).rejects.toMatchObject({
      code: 'failed',
      message: 'printer busy',
    })
  })

  it('lève « unreachable » quand le réseau est coupé', async () => {
    stubFetch(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(
      printBadgeOnQl800('http://127.0.0.1:9100', 'data:image/png;base64,AAAA'),
    ).rejects.toMatchObject({ code: 'unreachable' })
  })
})
