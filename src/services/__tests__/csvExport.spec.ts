import { describe, it, expect } from 'vitest'
import { attendeesToCsv } from '@/services/csvExport'
import type { Attendee } from '@/types/tickets'

const attendees: Attendee[] = [
  {
    id: 1,
    name: 'Alice Dupont',
    email: 'alice@example.com',
    ticket: 'VIP',
    checkedIn: true,
    fields: { 'Ab wann willst du dabei sein?': 'Freitag, den 2.' },
  },
  {
    id: 2,
    name: 'Bob "le grand"; Martin',
    email: 'bob@example.com',
    ticket: 'Standard',
    checkedIn: false,
    fields: { 'Ab wann willst du dabei sein?': 'Donnerstag, den 1.\nRéveil tôt', Kinder: '2' },
  },
]

describe('attendeesToCsv', () => {
  it('produit un CSV avec BOM, séparateur « ; » et union des champs', () => {
    const csv = attendeesToCsv(attendees)
    const lines = csv.split('\r\n')

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(lines[0]).toBe('﻿Nom;Email;Billet;Présent;Ab wann willst du dabei sein?;Kinder')
    expect(lines[1]).toBe('Alice Dupont;alice@example.com;VIP;Oui;Freitag, den 2.;')
  })

  it('échappe les cellules avec « ; », guillemets et sauts de ligne', () => {
    const csv = attendeesToCsv(attendees)

    expect(csv).toContain('"Bob ""le grand""; Martin"')
    expect(csv).toContain('"Donnerstag, den 1.\nRéveil tôt"')
  })

  it('gère une liste vide (en-têtes seuls via champs vides)', () => {
    expect(attendeesToCsv([])).toBe('\uFEFFNom;Email;Billet;Présent')
  })
})
