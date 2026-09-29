/**
 * Configuration de l'agent local d'impression Brother QL-800. L'agent tourne
 * sur le PC relié à l'imprimante (USB) — cette config est donc propre à
 * chaque poste : localStorage uniquement, jamais partagée côté serveur.
 */
export interface Ql800Config {
  /** URL de base de l'agent, ex. http://127.0.0.1:9100 */
  agentUrl: string
}

export const DEFAULT_QL800_CONFIG: Ql800Config = {
  agentUrl: 'http://127.0.0.1:9100',
}

export const QL800_CONFIG_STORAGE_KEY = 'etp-ql800-agent'

/** Normalise une URL d'agent : http(s) obligatoire, sans slash final. */
export function normalizeAgentUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''
  if (!raw) return DEFAULT_QL800_CONFIG.agentUrl
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return DEFAULT_QL800_CONFIG.agentUrl
    }
    return raw
  } catch {
    return DEFAULT_QL800_CONFIG.agentUrl
  }
}

export function normalizeQl800Config(value: unknown): Ql800Config {
  const parsed = value && typeof value === 'object' ? (value as Partial<Ql800Config>) : {}
  return { agentUrl: normalizeAgentUrl(parsed.agentUrl) }
}

export function loadQl800Config(storage: Storage = localStorage): Ql800Config {
  try {
    const raw = storage.getItem(QL800_CONFIG_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_QL800_CONFIG }
    return normalizeQl800Config(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_QL800_CONFIG }
  }
}

export function saveQl800Config(config: Ql800Config, storage: Storage = localStorage): void {
  storage.setItem(QL800_CONFIG_STORAGE_KEY, JSON.stringify(normalizeQl800Config(config)))
}
