import { describe, it, expect } from 'vitest'
import {
  parseChildrenField,
  childrenStats,
  arrivalStats,
  arrivalDay,
} from '@/services/attendeeStats'
import type { Attendee } from '@/types/tickets'

describe('parseChildrenField', () => {
  it.each([
    ['', { ages: [], unknown: 0 }],
    ['/', { ages: [], unknown: 0 }],
    ['0', { ages: [], unknown: 0 }],
    ['Null', { ages: [], unknown: 0 }],
    ['Siehe Oben', { ages: [], unknown: 0 }],
    ['2', { ages: [], unknown: 2 }],
    ['Zwei', { ages: [], unknown: 2 }],
    ['4 (5,5,3,1)', { ages: ['5', '5', '3', '1'], unknown: 0 }],
    ['5 Kindern ( 10, 8, 6, 4, 1)', { ages: ['10', '8', '6', '4', '1'], unknown: 0 }],
    ['3 Kinder ( 7Jahre, 5 Jahre und 1 Jahr)', { ages: ['7', '5', '1'], unknown: 0 }],
    ['1 kind (5), 1 kind (4), 1 kind (1)', { ages: ['5', '4', '1'], unknown: 0 }],
    ['1 (5 Jahre) und 1 (7 Jahre)', { ages: ['5', '7'], unknown: 0 }],
    ['1,3 und 5 Jahre', { ages: ['1', '3', '5'], unknown: 0 }],
    ['1x12 Jahre, 1x10 Jahre und 1x7 Jahre', { ages: ['12', '10', '7'], unknown: 0 }],
    ['1 x 11 Jahre und 1 x 15 Jahre', { ages: ['11', '15'], unknown: 0 }],
    ['"1x7 Jahre" "1×5Jahre" "1× 3Jahre" "2× 1 Jahre"', { ages: ['7', '5', '3', '1', '1'], unknown: 0 }],
    ['1 Kind (< 2 Jahre)', { ages: ['< 2'], unknown: 0 }],
    ['1 Kind (6 Monaten)', { ages: ['< 1'], unknown: 0 }],
  ])('« %s »', (input, expected) => {
    expect(parseChildrenField(input)).toEqual(expected)
  })
})

function attendeeWithFields(fields: Record<string, string>): Attendee {
  return { id: Math.random(), name: '', email: '', ticket: '', checkedIn: false, fields }
}

describe('childrenStats', () => {
  it('agrège les âges de tous les champs « Kinder », triés', () => {
    const stats = childrenStats([
      attendeeWithFields({ Kinder: '4 (5,5,3,1)' }),
      attendeeWithFields({ 'Anzahl der mitreisenden Kinder (8-14 Jahr)': 'Zwei' }),
      attendeeWithFields({ 'Anzahl der mitreisenden Kinder (8–14 Jahre)': '1 Kind (< 2 Jahre)' }),
      attendeeWithFields({ entreprise: 'Acme' }), // champ sans rapport : ignoré
    ])

    expect(stats).toEqual({
      total: 7,
      byAge: [
        { age: '< 2', count: 1 },
        { age: '1', count: 1 },
        { age: '3', count: 1 },
        { age: '5', count: 2 },
      ],
      unknown: 2,
    })
  })
})

describe('arrivalStats', () => {
  it('compte les réponses d’arrivée, tous formulaires confondus, triées par fréquence', () => {
    const stats = arrivalStats([
      attendeeWithFields({ 'Wann kommen Sie an?': 'Freitag (05.06.2026)' }),
      attendeeWithFields({ 'Ab wann willst du dabei sein?': 'Freitag, den 2.' }),
      attendeeWithFields({ 'Ab wann willst du dabei sein?': 'Freitag, den 2.' }),
      attendeeWithFields({ 'Wann kommen Sie an?': ' ' }),
      attendeeWithFields({ Kinder: '2' }),
    ])

    expect(stats).toEqual([
      { label: 'Freitag, den 2.', count: 2 },
      { label: 'Freitag (05.06.2026)', count: 1 },
    ])
  })

  it('arrivalDay retourne le jour déclaré, quel que soit le formulaire', () => {
    expect(arrivalDay(attendeeWithFields({ 'Wann kommen Sie an?': 'Donnerst' }))).toBe('Donnerst')
    expect(
      arrivalDay(attendeeWithFields({ 'Ab wann willst du dabei sein?': 'Samstag, den 3.' })),
    ).toBe('Samstag, den 3.')
    expect(arrivalDay(attendeeWithFields({ Kinder: '1' }))).toBeUndefined()
  })
})
