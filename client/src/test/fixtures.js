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
