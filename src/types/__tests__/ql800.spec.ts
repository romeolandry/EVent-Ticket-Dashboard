import { describe, it, expect } from 'vitest'
import {
  DEFAULT_QL800_CONFIG,
  loadQl800Config,
  normalizeAgentUrl,
  saveQl800Config,
} from '@/types/ql800'

describe('types/ql800 — normalizeAgentUrl', () => {
  it('conserve une URL http(s) valide et retire le slash final', () => {
    expect(normalizeAgentUrl('http://127.0.0.1:9100/')).toBe('http://127.0.0.1:9100')
    expect(normalizeAgentUrl(' https://agent.local:9100 ')).toBe('https://agent.local:9100')
  })

  it('retombe sur la valeur par défaut pour une URL invalide ou vide', () => {
    expect(normalizeAgentUrl('')).toBe(DEFAULT_QL800_CONFIG.agentUrl)
    expect(normalizeAgentUrl(undefined)).toBe(DEFAULT_QL800_CONFIG.agentUrl)
    expect(normalizeAgentUrl('ftp://x')).toBe(DEFAULT_QL800_CONFIG.agentUrl)
    expect(normalizeAgentUrl('pas une url')).toBe(DEFAULT_QL800_CONFIG.agentUrl)
  })
})

describe('types/ql800 — load/save', () => {
  function storageStub(initial: Record<string, string> = {}) {
    const store = { ...initial }
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      store,
    } as unknown as Storage
  }

  it('retourne la config par défaut sans valeur stockée', () => {
    expect(loadQl800Config(storageStub())).toEqual(DEFAULT_QL800_CONFIG)
  })

  it('ignore un JSON corrompu', () => {
    expect(loadQl800Config(storageStub({ 'etp-ql800-agent': '{oops' }))).toEqual(
      DEFAULT_QL800_CONFIG,
    )
  })

  it('persiste et recharge l’URL de l’agent', () => {
    const storage = storageStub()
    saveQl800Config({ agentUrl: 'http://192.168.1.20:9100/' }, storage)
    expect(loadQl800Config(storage).agentUrl).toBe('http://192.168.1.20:9100')
  })
})
