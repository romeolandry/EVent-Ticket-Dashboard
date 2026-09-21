import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function mockFetch(payload: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
    ok: true,
    json: async () => payload,
  } as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function headersOf(fetchMock: ReturnType<typeof mockFetch>): Record<string, string> {
  const [, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }]
  return options.headers
}

describe('wpApi — authentification', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_WP_API_URL', 'https://wp.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("n'envoie pas d'en-tête Authorization sans identifiants", async () => {
    const fetchMock = mockFetch({ events: [] })
    const { fetchEvents } = await import('@/services/wpApi')

    await fetchEvents()

    expect(headersOf(fetchMock)).toEqual({ Accept: 'application/json' })
  })

  it('ajoute un en-tête Authorization Basic quand les identifiants sont configurés', async () => {
    vi.stubEnv('VITE_WP_AUTH_USER', 'admin')
    vi.stubEnv('VITE_WP_AUTH_PASSWORD', 'xxxx yyyy zzzz wwww')
    const fetchMock = mockFetch({ events: [] })
    const { fetchEvents } = await import('@/services/wpApi')

    await fetchEvents()

    expect(headersOf(fetchMock).Authorization).toBe(`Basic ${btoa('admin:xxxx yyyy zzzz wwww')}`)
  })

  it("authentifie aussi les requêtes de participants", async () => {
    vi.stubEnv('VITE_WP_AUTH_USER', 'admin')
    vi.stubEnv('VITE_WP_AUTH_PASSWORD', 'secret')
    const fetchMock = mockFetch({ attendees: [] })
    const { fetchAttendees } = await import('@/services/wpApi')

    await fetchAttendees(42)

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe(
      'https://wp.test/wp-json/tribe/tickets/v1/attendees?event=42&per_page=100',
    )
    expect(headersOf(fetchMock).Authorization).toBe(`Basic ${btoa('admin:secret')}`)
  })
})
