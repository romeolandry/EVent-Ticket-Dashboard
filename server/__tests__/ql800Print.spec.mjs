import { describe, it, expect } from 'vitest'
import {
  agentConfigFromEnv,
  buildBrotherQlArgs,
  parsePngDataUrl,
} from '../ql800Print.mjs'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const TINY_PNG = Buffer.concat([PNG_MAGIC, Buffer.from('fake-png-payload')])
const TINY_PNG_DATA_URL = `data:image/png;base64,${TINY_PNG.toString('base64')}`

describe('server/ql800Print — parsePngDataUrl', () => {
  it('décode une data URL PNG valide', () => {
    expect(parsePngDataUrl(TINY_PNG_DATA_URL)?.equals(TINY_PNG)).toBe(true)
  })

  it('rejette les entrées qui ne sont pas des data URL PNG', () => {
    expect(parsePngDataUrl(undefined)).toBeNull()
    expect(parsePngDataUrl(null)).toBeNull()
    expect(parsePngDataUrl(42)).toBeNull()
    expect(parsePngDataUrl('')).toBeNull()
    expect(parsePngDataUrl('data:image/jpeg;base64,/9j/4AAQ')).toBeNull()
    expect(parsePngDataUrl(`data:image/png;base64,${Buffer.from('nope').toString('base64')}`))
      .toBeNull()
  })

  it('rejette un payload trop volumineux', () => {
    expect(parsePngDataUrl(TINY_PNG_DATA_URL, 4)).toBeNull()
    const big = `data:image/png;base64,${Buffer.concat([PNG_MAGIC, Buffer.alloc(100)]).toString('base64')}`
    expect(parsePngDataUrl(big, 50)).toBeNull()
  })
})

describe('server/ql800Print — buildBrotherQlArgs', () => {
  it('construit la commande par défaut (QL-800, USB, étiquette 62)', () => {
    expect(buildBrotherQlArgs({ imagePath: '/tmp/badge.png' })).toEqual([
      '-b',
      'file',
      '-p',
      'file:///dev/usb/lp0',
      '-m',
      'QL-800',
      'print',
      '-l',
      '62',
      '/tmp/badge.png',
    ])
  })

  it('prend en compte modèle, imprimante et étiquette personnalisés', () => {
    const args = buildBrotherQlArgs({
      model: 'QL-810W',
      printer: 'tcp://192.168.1.50',
      label: '62red',
      imagePath: '/tmp/x.png',
    })
    expect(args).toContain('QL-810W')
    expect(args).toContain('tcp://192.168.1.50')
    expect(args).toContain('62red')
  })

  it('rejette un chemin vide ou ressemblant à une option', () => {
    expect(() => buildBrotherQlArgs({ imagePath: '' })).toThrow('imagePath requis')
    expect(() => buildBrotherQlArgs({ imagePath: '--evil' })).toThrow('imagePath invalide')
  })
})

describe('server/ql800Print — agentConfigFromEnv', () => {
  it('applique les valeurs par défaut', () => {
    expect(agentConfigFromEnv({})).toEqual({
      host: '127.0.0.1',
      port: 9100,
      model: 'QL-800',
      printer: 'file:///dev/usb/lp0',
      label: '62',
    })
  })

  it('lit les variables d’environnement QL800_*', () => {
    const config = agentConfigFromEnv({
      QL800_HOST: '0.0.0.0',
      QL800_PORT: '9200',
      QL800_MODEL: 'QL-810W',
      QL800_PRINTER: 'tcp://192.168.1.50',
      QL800_LABEL: '62red',
    })
    expect(config).toEqual({
      host: '0.0.0.0',
      port: 9200,
      model: 'QL-810W',
      printer: 'tcp://192.168.1.50',
      label: '62red',
    })
  })
})
