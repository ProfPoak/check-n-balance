import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Without Vitest's globals, Testing Library can't clean up on its own
afterEach(cleanup)
