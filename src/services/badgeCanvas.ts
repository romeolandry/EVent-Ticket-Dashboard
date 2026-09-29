/**
 * Rendu du badge en PNG pour l'impression directe sur Brother QL-800
 * (rouleau continu 62 mm, DK-22205). Le canvas est dessiné à la résolution
 * native de l'imprimante : 696 pixels imprimables de large à 300 dpi —
 * brother_ql n'a ainsi aucune mise à l'échelle à faire.
 */

/** Largeur imprimable d'un rouleau 62 mm sur QL-800 (300 dpi). */
export const LABEL_WIDTH_PX = 696

export interface BadgeField {
  label: string
  value: string
}

/** Contenu du badge, déjà résolu (titre d'événement, libellés i18n…). */
export interface BadgeRenderData {
  /** URL du logo, null = pas de logo. */
  logoUrl: string | null
  eventTitle: string | null
  name: string
  /** Libellé du groupe (ex. « Groupe 2 »), null = pas de pastille. */
  groupLabel: string | null
  ticket: string | null
  email: string | null
  fields: BadgeField[]
  colorMode: 'color' | 'bw'
}

export interface BadgeCanvasDeps {
  createCanvas?: () => HTMLCanvasElement
  /** Charge une image ; null si indisponible (le badge part sans logo). */
  loadImage?: (src: string) => Promise<HTMLImageElement | null>
}

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif'
const MAX_HEIGHT_PX = 1600
const MARGIN_X = 32
const MARGIN_Y = 24

function font(size: number, weight = 400): string {
  return `${weight} ${size}px ${FONT_STACK}`
}

function loadImageDefault(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Réduit la taille de police jusqu'à ce que le texte tienne dans maxWidth. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): number {
  let size = 48
  const min = 22
  while (size > min) {
    ctx.font = font(size, 700)
    if (ctx.measureText(text).width <= maxWidth) return size
    size -= 2
  }
  ctx.font = font(min, 700)
  return min
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, radius)
    return
  }
  ctx.beginPath()
  ctx.rect(x, y, width, height)
}

/**
 * Dessine le badge et retourne une data URL PNG (`data:image/png;base64,…`)
 * prête à être envoyée à l'agent d'impression QL-800 (POST /print).
 */
export async function renderBadgePng(
  data: BadgeRenderData,
  deps: BadgeCanvasDeps = {},
): Promise<string> {
  const createCanvas = deps.createCanvas ?? (() => document.createElement('canvas'))
  const loadImage = deps.loadImage ?? loadImageDefault

  const bw = data.colorMode === 'bw'
  const ink = '#000'
  const muted = bw ? ink : '#555555'
  const accent = bw ? ink : '#4f46e5'
  const contentWidth = LABEL_WIDTH_PX - 2 * MARGIN_X

  const canvas = createCanvas()
  canvas.width = LABEL_WIDTH_PX
  canvas.height = MAX_HEIGHT_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d indisponible')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  const cx = LABEL_WIDTH_PX / 2
  let y = MARGIN_Y

  if (data.logoUrl) {
    const img = await loadImage(data.logoUrl)
    if (img) {
      const logoSize = 110
      const scale = Math.min(logoSize / img.width, logoSize / img.height, 1)
      const w = img.width * scale
      const h = img.height * scale
      if (bw && 'filter' in ctx) ctx.filter = 'grayscale(1)'
      ctx.drawImage(img, cx - w / 2, y, w, h)
      ctx.filter = 'none'
      y += h + 16
    }
  }

  if (data.eventTitle) {
    ctx.font = font(22)
    ctx.fillStyle = muted
    ctx.fillText(data.eventTitle.toUpperCase(), cx, y, contentWidth)
    y += 44
  }

  const nameSize = fitFont(ctx, data.name, contentWidth)
  ctx.fillStyle = ink
  ctx.fillText(data.name, cx, y, contentWidth)
  y += nameSize + 26

  if (data.groupLabel) {
    ctx.font = font(26, 700)
    const textWidth = ctx.measureText(data.groupLabel).width
    const pillWidth = textWidth + 48
    const pillHeight = 44
    roundedRect(ctx, cx - pillWidth / 2, y, pillWidth, pillHeight, pillHeight / 2)
    ctx.fillStyle = accent
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(data.groupLabel, cx, y + 9)
    y += pillHeight + 18
  }

  if (data.ticket) {
    ctx.font = font(28, 600)
    ctx.fillStyle = accent
    ctx.fillText(data.ticket, cx, y, contentWidth)
    y += 42
  }

  if (data.email) {
    ctx.font = font(22)
    ctx.fillStyle = muted
    ctx.fillText(data.email, cx, y, contentWidth)
    y += 34
  }

  ctx.font = font(22)
  ctx.fillStyle = ink
  for (const field of data.fields) {
    ctx.fillText(`${field.label} : ${field.value}`, cx, y, contentWidth)
    y += 32
  }

  y += MARGIN_Y

  // Recadrage à la hauteur exacte du contenu (rouleau continu + coupe auto)
  const final = createCanvas()
  final.width = LABEL_WIDTH_PX
  final.height = y
  const finalCtx = final.getContext('2d')
  if (!finalCtx) throw new Error('canvas 2d indisponible')
  finalCtx.fillStyle = '#ffffff'
  finalCtx.fillRect(0, 0, final.width, final.height)
  finalCtx.drawImage(canvas, 0, 0)
  return final.toDataURL('image/png')
}
