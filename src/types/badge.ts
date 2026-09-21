/** Configuration d'impression des badges (persistée dans localStorage). */
export interface BadgeConfig {
  /** Titre personnalisé affiché sur le badge ; vide = titre de l'événement. */
  customTitle: string
  showEventTitle: boolean
  showEmail: boolean
  showTicket: boolean
  showGroup: boolean
  /** Clés des champs personnalisés WordPress affichés sur le badge. */
  fieldKeys: string[]
}

export const DEFAULT_BADGE_CONFIG: BadgeConfig = {
  customTitle: '',
  showEventTitle: true,
  showEmail: true,
  showTicket: true,
  showGroup: true,
  fieldKeys: [],
}

export const BADGE_CONFIG_STORAGE_KEY = 'etp-badge-config'

export function loadBadgeConfig(storage: Storage = localStorage): BadgeConfig {
  try {
    const raw = storage.getItem(BADGE_CONFIG_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_BADGE_CONFIG }
    const parsed = JSON.parse(raw) as Partial<BadgeConfig>
    return {
      ...DEFAULT_BADGE_CONFIG,
      ...parsed,
      fieldKeys: Array.isArray(parsed.fieldKeys) ? parsed.fieldKeys : [],
    }
  } catch {
    return { ...DEFAULT_BADGE_CONFIG }
  }
}

export function saveBadgeConfig(config: BadgeConfig, storage: Storage = localStorage): void {
  storage.setItem(BADGE_CONFIG_STORAGE_KEY, JSON.stringify(config))
}
