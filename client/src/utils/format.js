// "2026-11-07" -> "11/7/2026"
// Built from its parts in local time: new Date("2026-11-07") would be midnight UTC,
// which is still Nov 6 in US time zones.
export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString()
}
