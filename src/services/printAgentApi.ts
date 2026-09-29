/**
 * Client HTTP de l'agent local d'impression Brother QL-800
 * (server/printAgent.mjs, lancé sur le PC relié à l'imprimante).
 */
import { normalizeAgentUrl } from '@/types/ql800'

export interface PrintAgentStatus {
  ok: boolean
  model?: string
  printer?: string
  label?: string
  brotherQl?: boolean
}

/** Erreur dont le message est une clé exploitable côté UI. */
export class PrintAgentError extends Error {
  constructor(
    public readonly code: 'unreachable' | 'failed',
    detail?: string,
  ) {
    super(detail ?? code)
    this.name = 'PrintAgentError'
  }
}

/** Teste la disponibilité de l'agent (GET /healthz, timeout 3 s). */
export async function pingPrintAgent(agentUrl: string): Promise<PrintAgentStatus> {
  try {
    const response = await fetch(`${normalizeAgentUrl(agentUrl)}/healthz`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) throw new PrintAgentError('unreachable')
    return (await response.json()) as PrintAgentStatus
  } catch (error) {
    if (error instanceof PrintAgentError) throw error
    throw new PrintAgentError('unreachable')
  }
}

/** Envoie un PNG (data URL) à l'agent pour impression immédiate. */
export async function printBadgeOnQl800(agentUrl: string, pngDataUrl: string): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${normalizeAgentUrl(agentUrl)}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: pngDataUrl }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new PrintAgentError('unreachable')
  }
  if (!response.ok) {
    const detail = await response
      .json()
      .then((body) => String(body?.detail ?? body?.error ?? ''))
      .catch(() => '')
    throw new PrintAgentError('failed', detail || `HTTP ${response.status}`)
  }
}
