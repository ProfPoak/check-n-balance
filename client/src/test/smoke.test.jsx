import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

it('renders into jsdom', () => {
  render(<h1>Smoke</h1>)
  expect(screen.getByRole('heading', { name: 'Smoke' })).toBeTruthy()
})

it('starts each test with a clean document', () => {
  expect(screen.queryByRole('heading', { name: 'Smoke' })).toBeNull()
})
