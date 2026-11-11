import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorMessage from '../../components/shared/ErrorMessage.jsx'

function alertText(data) {
  render(<ErrorMessage data={data} />)
  return screen.getByRole('alert').textContent
}

describe('ErrorMessage', () => {
  it.each([null, undefined])('renders nothing for %s', (data) => {
    const { container } = render(<ErrorMessage data={data} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows {error}', () => {
    expect(alertText({ error: 'Invalid email or password' })).toContain('Invalid email or password')
  })

  it('shows every message in {errors: [...]}', () => {
    const text = alertText({ errors: ['First problem', 'Second problem'] })
    expect(text).toContain('First problem')
    expect(text).toContain('Second problem')
  })

  it('shows field errors as "field: message", every message of every field', () => {
    const text = alertText({
      errors: {
        email: ['An email address must have an @-sign.'],
        password: ['Too short', 'Too plain'],
      },
    })
    expect(text).toContain('email: An email address must have an @-sign.')
    expect(text).toContain('password: Too short')
    expect(text).toContain('password: Too plain')
  })

  it('handles a field whose value is a single string', () => {
    expect(alertText({ errors: { months: 'Must be 1 to 24' } })).toContain('months: Must be 1 to 24')
  })

  it('shows _schema messages without a prefix', () => {
    const text = alertText({ errors: { _schema: ['Invalid input type.'] } })
    expect(text).toContain('Invalid input type.')
    expect(text).not.toContain('_schema')
  })

  it.each([
    ['{}', {}],
    ['{errors: {}}', { errors: {} }],
    ['{errors: []}', { errors: [] }],
    ['a string', 'Bad Gateway'],
    ['a number', 502],
  ])('falls back to "Something went wrong" for %s', (_label, data) => {
    expect(alertText(data)).toContain('Something went wrong')
  })

  it('does not add the fallback when there are real messages', () => {
    expect(alertText({ error: 'Nope' })).not.toContain('Something went wrong')
  })
})
