import { describe, it, expect } from 'vitest'
import {
  isAllowedEmail,
  isSuperuserEmail,
  isValidEmail,
  normalizeEmail,
  sanitizeEmailList,
} from '../accessList.mjs'

describe('normalizeEmail', () => {
  it('trim et met en minuscules', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com')
    expect(normalizeEmail(null)).toBe('')
  })
})

describe('isValidEmail', () => {
  it.each([
    ['alice@example.com', true],
    ['x@y.io', true],
    ['pas-un-email', false],
    ['a@b', false],
    ['@domaine.com', false],
    ['', false],
  ])('%s → %s', (email, expected) => {
    expect(isValidEmail(email)).toBe(expected)
  })
})

describe('isAllowedEmail', () => {
  const ctx = {
    superuserEmail: 'Admin@Wach-Auf.com',
    allowedEmails: ['staff@wach-auf.com', 'ouvrier@wach-auf.com'],
  }

  it('autorise le superuser (casse ignorée)', () => {
    expect(isAllowedEmail('admin@wach-auf.com', ctx)).toBe(true)
    expect(isAllowedEmail(' ADMIN@wach-auf.com ', ctx)).toBe(true)
  })

  it('autorise les emails de la liste acceptée', () => {
    expect(isAllowedEmail('staff@wach-auf.com', ctx)).toBe(true)
    expect(isAllowedEmail('STAFF@Wach-Auf.com', ctx)).toBe(true)
  })

  it('rejette tout le reste', () => {
    expect(isAllowedEmail('inconnu@example.com', ctx)).toBe(false)
    expect(isAllowedEmail('', ctx)).toBe(false)
    expect(isAllowedEmail('staff@wach-auf.comx', ctx)).toBe(false)
  })

  it('fonctionne avec une liste vide', () => {
    expect(isAllowedEmail('x@y.z', { superuserEmail: 'a@b.cd', allowedEmails: [] })).toBe(false)
  })

  it('autorise tous les superusers d’une liste séparée par des virgules', () => {
    const ctxMulti = { ...ctx, superuserEmail: 'admin@wach-auf.com,admin2@wach-auf.com' }
    expect(isAllowedEmail('admin@wach-auf.com', ctxMulti)).toBe(true)
    expect(isAllowedEmail('Admin2@Wach-Auf.com', ctxMulti)).toBe(true)
    expect(isAllowedEmail('inconnu@example.com', ctxMulti)).toBe(false)
  })
})

describe('isSuperuserEmail', () => {
  it('ne reconnaît que le superuser', () => {
    expect(isSuperuserEmail('admin@wach-auf.com', 'admin@wach-auf.com')).toBe(true)
    expect(isSuperuserEmail('Admin@Wach-Auf.com', 'admin@wach-auf.com')).toBe(true)
    expect(isSuperuserEmail('autre@wach-auf.com', 'admin@wach-auf.com')).toBe(false)
    expect(isSuperuserEmail('', '')).toBe(false)
  })

  it('accepte plusieurs superusers séparés par des virgules', () => {
    const env = 'admin@wach-auf.com, Second@Wach-Auf.com ,troisieme@wach-auf.com'
    expect(isSuperuserEmail('admin@wach-auf.com', env)).toBe(true)
    expect(isSuperuserEmail('second@wach-auf.com', env)).toBe(true)
    expect(isSuperuserEmail('TROISIEME@wach-auf.com', env)).toBe(true)
    expect(isSuperuserEmail('autre@wach-auf.com', env)).toBe(false)
  })

  it('un préfixe doublé dans le .env corrompt la première entrée', () => {
    // Regression : « SUPERUSER_EMAIL=SUPERUSER_EMAIL=a@x.com,b@y.com » ne
    // reconnaissait que le dernier email. L'entrée corrompue contient « = »
    // (le serveur log un avertissement au démarrage dans ce cas).
    const env = 'SUPERUSER_EMAIL=premier@wach-auf.com,dernier@wach-auf.com'
    expect(isSuperuserEmail('premier@wach-auf.com', env)).toBe(false)
    expect(isSuperuserEmail('dernier@wach-auf.com', env)).toBe(true)
  })
})

describe('sanitizeEmailList', () => {
  it('normalise, déduplique et rejette les emails invalides', () => {
    const { cleaned, invalid } = sanitizeEmailList([
      ' Alice@Example.com ',
      'alice@example.com',
      'bob@example.org',
      'pas-un-email',
      '',
    ])

    expect(cleaned).toEqual(['alice@example.com', 'bob@example.org'])
    expect(invalid).toEqual(['pas-un-email'])
  })
})
