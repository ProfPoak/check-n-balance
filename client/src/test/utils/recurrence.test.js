import { describe, expect, it } from 'vitest'
import { PRESETS, recurrenceLabel } from '../../utils/recurrence.js'

describe('PRESETS', () => {
  it('are the six roadmap presets, in order', () => {
    expect(PRESETS.map(({ label, interval, unit }) => ({ label, interval, unit }))).toEqual([
      { label: 'One-time', interval: null, unit: 'once' },
      { label: 'Weekly', interval: 1, unit: 'week' },
      { label: 'Every 2 weeks', interval: 2, unit: 'week' },
      { label: 'Monthly', interval: 1, unit: 'month' },
      { label: 'Every 3 months', interval: 3, unit: 'month' },
      { label: 'Yearly', interval: 1, unit: 'year' },
    ])
  })
})

describe('recurrenceLabel', () => {
  it.each([
    [{ interval: null, unit: 'once' }, 'One-time'],
    [{ interval: 1, unit: 'week' }, 'Weekly'],
    [{ interval: 2, unit: 'week' }, 'Every 2 weeks'],
    [{ interval: 1, unit: 'month' }, 'Monthly'],
    [{ interval: 3, unit: 'month' }, 'Every 3 months'],
    [{ interval: 1, unit: 'year' }, 'Yearly'],
  ])('%o is "%s"', (item, label) => {
    expect(recurrenceLabel(item)).toBe(label)
  })

  it.each([
    [{ interval: 10, unit: 'day' }, 'Every 10 days'],
    [{ interval: 2, unit: 'month' }, 'Every 2 months'],
    [{ interval: 4, unit: 'week' }, 'Every 4 weeks'],
    [{ interval: 5, unit: 'year' }, 'Every 5 years'],
  ])('a custom %o falls back to "%s"', (item, label) => {
    expect(recurrenceLabel(item)).toBe(label)
  })

  it('ignores the other fields on a full item', () => {
    expect(recurrenceLabel({ id: 2, name: 'Rent', amount: '1450.00', interval: 1, unit: 'month' })).toBe('Monthly')
  })
})
