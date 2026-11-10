const money = Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// "2026-11-07" -> "11/7/2026"
// Built from its parts in local time: new Date("2026-11-07") would be midnight UTC,
// which is still Nov 6 in US time zones.
export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString()
}

// "1450.00" -> "$1,450.00", "-1200.00" -> "-$1,200.00"
export function formatMoney(str) {
  const num = Number(str)
  return money.format(num)
}

// "2026-11" -> "Nov 2026"
export function formatMonth(ym) {
  const [year, month] = ym.split('-').map(Number)
  const date = new Date(year, month - 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
