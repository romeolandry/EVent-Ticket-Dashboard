import { describe, it, expect, vi } from 'vitest'
import {
  LABEL_WIDTH_PX,
  renderBadgePng,
  type BadgeRenderData,
} from '@/services/badgeCanvas'

/** Canvas 2D factice : largeur de texte proportionnelle à la taille de police. */
function createMockCanvas() {
  const calls = { fillText: [] as string[], fonts: [] as string[], drawImage: 0, filters: [] as string[] }
  let font = '16px sans-serif'
  const ctx = {
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    filter: 'none',
    get font() {
      return font
    },
    set font(value: string) {
      font = value
    },
    fillRect: vi.fn<() => void>(),
    fillText: vi.fn<(text: string) => void>((text: string) => {
      calls.fillText.push(String(text))
      calls.fonts.push(font)
    }),
    drawImage: vi.fn<() => void>(() => {
      calls.drawImage++
      if (ctx.filter !== 'none') calls.filters.push(ctx.filter)
    }),
    measureText: vi.fn<(text: string) => { width: number }>((text: string) => {
      const size = Number(font.match(/(\d+)px/)?.[1] ?? 16)
      return { width: String(text).length * (size / 2) }
    }),
    beginPath: vi.fn<() => void>(),
    roundRect: vi.fn<() => void>(),
    rect: vi.fn<() => void>(),
    fill: vi.fn<() => void>(),
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn<() => typeof ctx>(() => ctx),
    toDataURL: vi.fn<() => string>(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='),
  }
  return { canvas: canvas as unknown as HTMLCanvasElement, ctx, calls }
}

function mountDeps() {
  const scratch = createMockCanvas()
  const final = createMockCanvas()
  return {
    createCanvas: vi
      .fn<() => HTMLCanvasElement>()
      .mockReturnValueOnce(scratch.canvas)
      .mockReturnValueOnce(final.canvas),
    loadImage: vi.fn<(src: string) => Promise<HTMLImageElement | null>>(
      async (_src: string) => ({ width: 48, height: 48 }) as HTMLImageElement,
    ),
    scratch,
    final,
  }
}

const FULL_BADGE: BadgeRenderData = {
  logoUrl: 'http://localhost/favicon.png',
  eventTitle: 'Gebetskonferenz 2026',
  name: 'Alice Dupont',
  groupLabel: 'Groupe 2',
  ticket: 'T-1234',
  email: 'alice@example.com',
  fields: [{ label: 'Enfants', value: '2' }],
  colorMode: 'color',
}

describe('services/badgeCanvas — renderBadgePng', () => {
  it('dessine tous les éléments du badge à la largeur QL-800 (62 mm)', async () => {
    const deps = mountDeps()
    const png = await renderBadgePng(FULL_BADGE, deps)

    expect(png).toMatch(/^data:image\/png;base64,/)
    expect(deps.scratch.canvas.width).toBe(LABEL_WIDTH_PX)
    expect(deps.final.canvas.width).toBe(LABEL_WIDTH_PX)
    expect(deps.final.canvas.height).toBeGreaterThan(0)
    expect(deps.final.canvas.height).toBeLessThan(1600)

    const texts = deps.scratch.calls.fillText
    expect(texts).toContain('GEBETSKONFERENZ 2026')
    expect(texts).toContain('Alice Dupont')
    expect(texts).toContain('Groupe 2')
    expect(texts).toContain('T-1234')
    expect(texts).toContain('alice@example.com')
    expect(texts).toContain('Enfants : 2')
    expect(deps.scratch.calls.drawImage).toBe(1) // logo
  })

  it('réduit la taille du nom trop long pour tenir sur l’étiquette', async () => {
    const deps = mountDeps()
    const longName = `${'Jean-Baptiste-Maximilien-'.repeat(2)}Dupont`
    await renderBadgePng({ ...FULL_BADGE, name: longName, logoUrl: null }, deps)

    const index = deps.scratch.calls.fillText.indexOf(longName)
    expect(index).toBeGreaterThanOrEqual(0)
    const usedSize = Number(deps.scratch.calls.fonts[index]?.match(/(\d+)px/)?.[1])
    expect(usedSize).toBeLessThan(48) // taille réduite au lieu de déborder
  })

  it('imprime un badge sans logo si l’image est indisponible', async () => {
    const deps = mountDeps()
    deps.loadImage.mockResolvedValue(null)
    const png = await renderBadgePng(FULL_BADGE, deps)

    expect(png).toMatch(/^data:image\/png;base64,/)
    expect(deps.scratch.calls.drawImage).toBe(0)
    expect(deps.scratch.calls.fillText).toContain('Alice Dupont')
  })

  it('passe le logo en niveaux de gris en mode noir et blanc', async () => {
    const deps = mountDeps()
    await renderBadgePng({ ...FULL_BADGE, colorMode: 'bw' }, deps)

    expect(deps.scratch.calls.filters).toContain('grayscale(1)')
  })
})
