// Budgets as GET /budgets/:id sends them (nested items and assets), shaped like the seed.
// Money comes back as strings, dates as YYYY-MM-DD.

const item = (fields) => ({ end_date: null, interval: 1, unit: 'month', ...fields })

export const CURRENT = {
  id: 1,
  title: 'Current',
  description: 'Real numbers',
  balance_as_of: '2026-11-09',
  cash_flow_items: [
    item({ id: 1, kind: 'income', name: 'Paycheck', amount: '2100.00', start_date: '2026-01-02', interval: 2, unit: 'week' }),
    item({ id: 2, kind: 'expense', name: 'Rent', amount: '1450.00', start_date: '2026-01-01' }),
    item({ id: 3, kind: 'expense', name: 'Car payment', amount: '320.00', start_date: '2025-06-15', end_date: '2029-05-15' }),
    item({ id: 4, kind: 'expense', name: 'Car insurance', amount: '960.00', start_date: '2026-03-01', unit: 'year' }),
    item({ id: 5, kind: 'expense', name: 'Vet visit', amount: '400.00', start_date: '2026-12-10', interval: null, unit: 'once' }),
  ],
  assets: [
    { id: 1, name: 'Checking', balance: '2500.00' },
    { id: 2, name: 'Savings', balance: '8000.00' },
  ],
}

export const WHAT_IF = {
  id: 2,
  title: 'New car what-if',
  description: 'Current, plus a bigger car payment',
  balance_as_of: '2026-11-09',
  cash_flow_items: [
    item({ id: 11, kind: 'expense', name: 'New car payment', amount: '540.00', start_date: '2026-12-01', end_date: '2031-11-01' }),
  ],
  assets: [{ id: 11, name: 'Brokerage', balance: '1200.00' }],
}

// A brand-new budget from Home's "+"
export const UNTITLED = {
  id: 9,
  title: 'Untitled budget',
  description: null,
  balance_as_of: '2026-11-09',
  cash_flow_items: [],
  assets: [],
}

// The GET /budgets list form (no items or assets)
export const summary = ({ id, title, description, balance_as_of }) => ({ id, title, description, balance_as_of })

// ---- Day 8: what /timeline and /monthly send ----

// The server's 6-month window (this month + the next 5). The client never builds these.
export const MONTHS = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04']

// One GET /budgets/:id/timeline entry for an item on a date
export const entry = ({ id, name, kind, amount }, date) => ({ item_id: id, name, kind, amount, date })

// GET /budgets/:id/monthly for a budget with nothing in the window
export const emptyMonthly = () => MONTHS.map((month) => ({ month, income: '0.00', expenses: '0.00', net: '0.00' }))

const [PAYCHECK, RENT, CAR, , VET] = CURRENT.cash_flow_items

// "Current" for Nov–Dec, sorted by date then name, as the server sends it
export const CURRENT_TIMELINE = [
  entry(RENT, '2026-11-01'),
  entry(PAYCHECK, '2026-11-06'),
  entry(CAR, '2026-11-15'),
  entry(PAYCHECK, '2026-11-20'),
  entry(RENT, '2026-12-01'),
  entry(PAYCHECK, '2026-12-04'),
  entry(VET, '2026-12-10'),
  entry(CAR, '2026-12-15'),
  entry(PAYCHECK, '2026-12-18'),
]

export const WHAT_IF_TIMELINE = [entry(WHAT_IF.cash_flow_items[0], '2026-12-01')]

// Empty /timeline and /monthly answers for each budget id, for tests that don't look at them
export function scheduleRoutes(...ids) {
  const routes = {}
  for (const id of ids) {
    routes[`GET /api/budgets/${id}/timeline`] = [200, []]
    routes[`GET /api/budgets/${id}/monthly`] = [200, emptyMonthly()]
  }
  return routes
}

// One GET /budgets/:id/monthly row. Net is income - expenses, as the server sends it.
export const monthRow = (month, income, expenses) => ({
  month,
  income,
  expenses,
  net: (Number(income) - Number(expenses)).toFixed(2),
})

// "Current": Nov 2430 → Dec 2030 (down) → Jan 4530 (up) → Feb 2430 (down) → Mar 1470 (down) → Apr 1470 (same)
export const CURRENT_MONTHLY = [
  monthRow('2026-11', '4200.00', '1770.00'),
  monthRow('2026-12', '4200.00', '2170.00'),
  monthRow('2027-01', '6300.00', '1770.00'),
  monthRow('2027-02', '4200.00', '1770.00'),
  monthRow('2027-03', '4200.00', '2730.00'),
  monthRow('2027-04', '4200.00', '2730.00'),
]

// "New car what-if": nothing in Nov, then only the car payment, so Net goes negative
export const WHAT_IF_MONTHLY = [
  monthRow('2026-11', '0.00', '0.00'),
  ...MONTHS.slice(1).map((m) => monthRow(m, '0.00', '540.00')),
]
