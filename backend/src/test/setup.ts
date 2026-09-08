import { beforeAll, afterAll, vi } from 'vitest'

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  expressErrorHandler: vi.fn(() => (err: Error, _req: any, _res: any, next: any) => next(err))
}))

beforeAll(() => {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET = 'test-secret-key-min-32-characters-long'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-min-32-chars-long'
  process.env.FRONTEND_URL = 'http://localhost:5173'
  process.env.PORT = '3001'
})

afterAll(() => {
  vi.clearAllMocks()
})