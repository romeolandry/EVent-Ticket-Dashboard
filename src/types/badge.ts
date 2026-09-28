/**
 * Configuration d'impression des badges. Persistée côté serveur
 * (`/api/settings?key=badge-config`) et partagée entre tous les
 * utilisateurs connectés ; localStorage sert de cache hors-ligne.
 */
export interface BadgeConfig {
  /** Titre personnalisé affiché sur le badge ; vide = titre de l'événement. */
  customTitle: string
  showEventTitle: boolean
  showEmail: boolean
  showTicket: boolean
  showGroup: boolean
  /** Affiche le logo (favicon de l'application) en haut du badge. */
  showLogo: boolean
  /** Rendu couleur ou noir et blanc du badge imprimé. */
  colorMode: 'color' | 'bw'
  /** Clés des champs personnalisés WordPress affichés sur le badge. */
  fieldKeys: string[]
}

export const DEFAULT_BADGE_CONFIG: BadgeConfig = {
  customTitle: '',
  showEventTitle: true,
  showEmail: true,
  showTicket: true,
  showGroup: true,
  showLogo: true,
  colorMode: 'color',
  fieldKeys: [],
}

export const BADGE_CONFIG_STORAGE_KEY = 'etp-badge-config'
export const BADGE_CONFIG_SETTING_KEY = 'badge-config'

/** Nettoie une valeur inconnue (serveur ou cache local) en BadgeConfig. */
export function normalizeBadgeConfig(value: unknown): BadgeConfig {
  const parsed = value && typeof value === 'object' ? (value as Partial<BadgeConfig>) : {}
  return {
    ...DEFAULT_BADGE_CONFIG,
    ...parsed,
    colorMode: parsed.colorMode === 'bw' ? 'bw' : 'color',
    fieldKeys: Array.isArray(parsed.fieldKeys)
      ? parsed.fieldKeys.filter((k): k is string => typeof k === 'string')
      : [],
  }
}

export function loadBadgeConfig(storage: Storage = localStorage): BadgeConfig {
  try {
    const raw = storage.getItem(BADGE_CONFIG_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_BADGE_CONFIG }
    return normalizeBadgeConfig(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_BADGE_CONFIG }
  }
}

export function saveBadgeConfig(config: BadgeConfig, storage: Storage = localStorage): void {
  storage.setItem(BADGE_CONFIG_STORAGE_KEY, JSON.stringify(config))
}
