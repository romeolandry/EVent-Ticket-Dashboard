import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_EXPIRED_EVENT } from '@/services/sessionEvents'

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
    // Isole du .env réel chargé par Vite
    vi.stubEnv('VITE_WP_AUTH_USER', '')
    vi.stubEnv('VITE_WP_AUTH_PASSWORD', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('appelle le proxy /wp-api sans identifiants WordPress dans le navigateur', async () => {
    const fetchMock = mockFetch({ events: [] })
    const { fetchEvents } = await import('@/services/wpApi')

    await fetchEvents()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('/wp-api/tribe/events/v1/events?start_date=2000-01-01&per_page=100&page=1')
    expect(url).not.toContain('wach-auf.com')
    expect(headersOf(fetchMock).Authorization).toBeUndefined()
  })

  it('ajoute le token de session Bearer sur chaque requête', async () => {
    localStorage.setItem('etp-auth-token', 'tok-xyz')
    const fetchMock = mockFetch({ attendees: [] })
    const { fetchAttendees } = await import('@/services/wpApi')

    await fetchAttendees(42)

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls).toContain('/wp-api/tribe/tickets/v1/attendees?per_page=100&page=1')
    expect(headersOf(fetchMock).Authorization).toBe('Bearer tok-xyz')
    localStorage.removeItem('etp-auth-token')
  })

  it('signale une session expirée sur 401/403', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue({ ok: false, status: 401 } as Response),
    )
    const { fetchEvents } = await import('@/services/wpApi')

    const listener = vi.fn<() => void>()
    window.addEventListener(SESSION_EXPIRED_EVENT, listener)

    await expect(fetchEvents()).rejects.toThrow('Session expirée')
    expect(listener).toHaveBeenCalledOnce()

    window.removeEventListener(SESSION_EXPIRED_EVENT, listener)
  })
})

describe('wpApi — événements', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_WP_API_URL', 'https://wp.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  function day(offsetDays: number): string {
    const date = new Date()
    date.setDate(date.getDate() + offsetDays)
    return date.toISOString().slice(0, 10)
  }

  it('ne retourne que les événements à venir', async () => {
    mockFetch({
      events: [
        { id: 1, title: 'Passé', start_date: `${day(-30)} 09:00:00`, end_date: `${day(-29)} 18:00:00` },
        { id: 2, title: 'Futur', start_date: `${day(30)} 09:00:00`, end_date: `${day(31)} 18:00:00` },
        { id: 3, title: 'Terminé hier', start_date: `${day(-3)} 09:00:00`, end_date: `${day(-1)} 18:00:00` },
      ],
    })
    const { fetchEvents } = await import('@/services/wpApi')

    const events = await fetchEvents()

    expect(events.map((e) => e.id)).toEqual([2])
  })

  it('exclut les brouillons et événements privés', async () => {
    mockFetch({
      events: [
        { id: 1, title: 'Public futur', start_date: `${day(30)} 09:00:00`, status: 'publish' },
        { id: 2, title: 'Brouillon', start_date: `${day(30)} 09:00:00`, status: 'draft' },
        { id: 3, title: 'Privé', start_date: `${day(30)} 09:00:00`, status: 'private' },
      ],
    })
    const { fetchEvents } = await import('@/services/wpApi')

    const events = await fetchEvents()

    expect(events.map((e) => e.id)).toEqual([1])
  })

  it('demande un start_date passé pour inclure les événements en cours', async () => {
    const fetchMock = mockFetch({ events: [], total_pages: 1 })
    const { fetchEvents } = await import('@/services/wpApi')

    await fetchEvents()

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls).toEqual(['/wp-api/tribe/events/v1/events?start_date=2000-01-01&per_page=100&page=1'])
  })

  it('récupère toutes les pages d’événements', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input)
      const payload = url.includes('page=2')
        ? { events: [{ id: 2, title: 'Page 2', start_date: `${day(30)} 09:00:00` }] }
        : {
            events: [{ id: 1, title: 'Page 1', start_date: `${day(30)} 09:00:00` }],
            total_pages: 2,
          }
      return { ok: true, json: async () => payload } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchEvents } = await import('@/services/wpApi')

    const events = await fetchEvents()

    expect(events.map((e) => e.id)).toEqual([1, 2])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('garde les événements en cours ou se terminant aujourd’hui', async () => {
    mockFetch({
      events: [
        { id: 1, title: 'En cours', start_date: `${day(-1)} 09:00:00`, end_date: `${day(2)} 18:00:00` },
        { id: 2, title: 'Se termine aujourd’hui', start_date: `${day(-2)} 09:00:00`, end_date: `${day(0)} 18:00:00` },
        { id: 3, title: 'Sans date' },
      ],
    })
    const { fetchEvents } = await import('@/services/wpApi')

    const events = await fetchEvents()

    expect(events.map((e) => e.id)).toEqual([1, 2, 3])
  })
})

describe('wpApi — check-in / check-out', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_WP_API_URL', 'https://wp.test')
    vi.stubEnv('VITE_WP_AUTH_USER', '')
    vi.stubEnv('VITE_WP_AUTH_PASSWORD', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('envoie un PATCH avec le paramètre check_in via le proxy', async () => {
    localStorage.setItem('etp-auth-token', 'tok-p')
    const fetchMock = mockFetch({})
    const { setCheckedIn } = await import('@/services/wpApi')

    await setCheckedIn(1089, true)

    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ]
    expect(url).toBe('/wp-api/tribe/tickets/v1/attendees/1089')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(String(options.body))).toEqual({ check_in: true })
    expect(options.headers.Authorization).toBe('Bearer tok-p')
    localStorage.removeItem('etp-auth-token')
  })

  it('lève une erreur si le serveur refuse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue({ ok: false, status: 500 } as Response),
    )
    const { setCheckedIn } = await import('@/services/wpApi')

    await expect(setCheckedIn(1, false)).rejects.toThrow('check-out')
  })
})

describe('wpApi — participants', () => {
  const futureEvent = {
    id: 1262,
    title: 'Futur',
    start_date: '2099-10-01 00:00:00',
    status: 'publish',
  }

  function mockApi(attendeesPages: unknown[], events: unknown[] = [futureEvent]) {
    let page = 0
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input)
      const payload = url.includes('/attendees?')
        ? attendeesPages[Math.min(page++, attendeesPages.length - 1)]
        : { events }
      return { ok: true, json: async () => payload } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_WP_API_URL', 'https://wp.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('normalise le payload réel (champs « information », email, billet objet)', async () => {
    mockApi([
      {
        total_pages: 1,
        attendees: [
          {
            id: 1139,
            post_id: 1262,
            title: 'Abraham Gueche Nkwonkam ',
            email: 'nkwonkamabraham@yahoo.fr',
            ticket: { id: 899, title: 'Studenten/Schüler' },
            checked_in: true,
            information: {
              'Anzahl der mitreisenden Kinder (8-14 Jahr)': '&lt; 2 Jahre',
              'Willst du unterstützen?': 'Sonstige',
            },
          },
        ],
      },
    ])
    const { fetchAttendees } = await import('@/services/wpApi')

    const [attendee] = await fetchAttendees(1262)

    expect(attendee).toEqual({
      id: 1139,
      name: 'Abraham Gueche Nkwonkam',
      email: 'nkwonkamabraham@yahoo.fr',
      ticket: 'Studenten/Schüler',
      checkedIn: true,
      fields: {
        'Anzahl der mitreisenden Kinder (8-14 Jahr)': '< 2 Jahre',
        'Willst du unterstützen?': 'Sonstige',
      },
    })
  })

  it('récupère toutes les pages de participants', async () => {
    const fetchMock = mockApi([
      { total_pages: 2, attendees: [{ id: 1, post_id: 1262 }] },
      { total_pages: 2, attendees: [{ id: 2, post_id: 1262 }] },
    ])
    const { fetchAttendees } = await import('@/services/wpApi')

    const attendees = await fetchAttendees(1262)

    expect(attendees.map((a) => a.id)).toEqual([1, 2])
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    const attendeeUrls = urls.filter((u) => u.includes('/attendees?'))
    expect(attendeeUrls[0]).toContain('page=1')
    expect(attendeeUrls[1]).toContain('page=2')
    expect(attendeeUrls.every((u) => !u.includes('event='))).toBe(true)
  })

  it('ne garde que les participants de l’événement demandé (post_id)', async () => {
    // Le endpoint ignore le paramètre event= : on doit filtrer côté client
    mockApi([
      {
        total_pages: 1,
        attendees: [
          { id: 1, post_id: 1262, title: 'Octobre' },
          { id: 2, post_id: 897, title: 'Avril (autre événement)' },
          { id: 3, post_id: 1262, title: 'Octobre bis' },
        ],
      },
    ])
    const { fetchAttendees } = await import('@/services/wpApi')

    const attendees = await fetchAttendees(1262)

    expect(attendees.map((a) => a.id)).toEqual([1, 3])
  })

  it('exclut les participants dont l’événement est brouillon ou passé', async () => {
    mockApi(
      [
        {
          total_pages: 1,
          attendees: [{ id: 1, post_id: 1298 }, { id: 2, post_id: 897 }],
        },
      ],
      [
        futureEvent,
        { id: 1298, title: 'Brouillon', start_date: '2099-05-27 00:00:00', status: 'draft' },
        { id: 897, title: 'Passé', start_date: '2020-04-16 00:00:00', status: 'publish' },
      ],
    )
    const { fetchAttendees } = await import('@/services/wpApi')

    expect(await fetchAttendees(1298)).toEqual([])
    expect(await fetchAttendees(897)).toEqual([])
  })
})
