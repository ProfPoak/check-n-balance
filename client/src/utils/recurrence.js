export const PRESETS = [
  { key: 'once', label: 'One-time', interval: null, unit: 'once' },
  { key: '1-week', label: 'Weekly', interval: 1, unit: 'week' },
  { key: '2-week', label: 'Every 2 weeks', interval: 2, unit: 'week' },
  { key: '1-month', label: 'Monthly', interval: 1, unit: 'month' },
  { key: '3-month', label: 'Every 3 months', interval: 3, unit: 'month' },
  { key: '1-year', label: 'Yearly', interval: 1, unit: 'year' },
]

export function recurrenceLabel(item) {
  const preset = PRESETS.find((p) => p.interval === item.interval && p.unit === item.unit)
  return preset ? preset.label : `Every ${item.interval} ${item.unit}s`
}
