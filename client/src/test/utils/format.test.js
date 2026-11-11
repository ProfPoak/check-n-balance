import { describe, expect, it } from 'vitest'
import { formatMoney, formatMonth } from '../../utils/format.js'

// A US time zone, so a UTC date bug would show the month before
globalThis.process.env.TZ = 'America/Denver'

describe('formatMoney', () => {
  it('adds a $, thousands commas and 2 decimals', () => {
    expect(formatMoney('1450.00')).toBe('$1,450.00')
    expect(formatMoney('2100.5')).toBe('$2,100.50')
  })

  it('formats zero as $0.00', () => {
    expect(formatMoney('0.00')).toBe('$0.00')
  })

  it('puts the minus sign before the $', () => {
    expect(formatMoney('-1200.00')).toBe('-$1,200.00')
  })

  it('handles values under a dollar and up to the server cap', () => {
    expect(formatMoney('0.07')).toBe('$0.07')
    expect(formatMoney('99999999.99')).toBe('$99,999,999.99')
  })
})

describe('formatMonth', () => {
  it('turns "YYYY-MM" into a short month and year', () => {
    expect(formatMonth('2026-11')).toBe('Nov 2026')
    expect(formatMonth('2027-01')).toBe('Jan 2027')
  })

  it('stays in the right month in a US time zone', () => {
    // new Date("2026-12") is midnight UTC on Dec 1, which is still Nov 30 in Denver
    expect(formatMonth('2026-12')).toBe('Dec 2026')
    expect(formatMonth('2026-03')).toBe('Mar 2026')
  })
})
