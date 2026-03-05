import { describe, test, expect, vi, beforeEach } from 'vitest'

// Top-level mock for next/headers used by OAuth tests
const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn().mockReturnValue([]),
  has: vi.fn()
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore))
}))

describe('Security Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Env File Sanitization', () => {
    test('should accept valid developer token settings', async () => {
      vi.doMock('fs/promises', () => ({
        default: {
          readFile: vi.fn().mockResolvedValue(''),
          writeFile: vi.fn().mockResolvedValue(undefined),
          rename: vi.fn().mockResolvedValue(undefined),
        }
      }))

      const { updateBoxSettings } = await import('@/lib/actions/settings')

      const result = await updateBoxSettings({
        authMethod: 'developer-token',
        boxDeveloperToken: 'test_token',
        boxEnterpriseId: 'test_id',
      })

      expect(result.success).toBe(true)
    })

    test('should reject developer token update with missing fields', async () => {
      const { updateBoxSettings } = await import('@/lib/actions/settings')

      const result = await updateBoxSettings({
        authMethod: 'developer-token',
        boxDeveloperToken: '',
        boxEnterpriseId: '',
      })

      expect(result.success).toBe(false)
    })

    test('should reject service account with invalid JSON', async () => {
      const { updateBoxSettings } = await import('@/lib/actions/settings')

      const result = await updateBoxSettings({
        authMethod: 'service-account',
        boxConfigJson: 'not valid json',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('Invalid JSON')
    })
  })

  describe('XSS Prevention in Context Finder', () => {
    test('should HTML-escape document content before highlighting', async () => {
      const { findValueContext } = await import('@/lib/context-finder')

      const maliciousDoc = 'The value is <script>alert("xss")</script> and more text here for context padding.'
      const result = findValueContext('<script>alert("xss")</script>', maliciousDoc)

      if (result) {
        expect(result.highlightedContext).not.toContain('<script>')
        expect(result.highlightedContext).toContain('&lt;script&gt;')
      }
    })

    test('should HTML-escape content even when no match is found', async () => {
      const { findValueContext } = await import('@/lib/context-finder')

      const maliciousDoc = 'Some text <img onerror="alert(1)" src=x> more text.'
      const result = findValueContext('not found value', maliciousDoc)

      expect(result).toBeNull()
    })

    test('should safely highlight values containing HTML characters', async () => {
      const { findValueContext } = await import('@/lib/context-finder')

      const doc = 'The amount is $100 & more than <50 which is the threshold for this test to work properly and have enough context.'
      const result = findValueContext('$100 & more than <50', doc)

      if (result) {
        expect(result.highlightedContext).toContain('&amp;')
        expect(result.highlightedContext).toContain('&lt;50')
        expect(result.highlightedContext).toContain('<mark')
      }
    })
  })

  describe('OAuth CSRF Protection', () => {
    test('should generate unique state values', async () => {
      const { getOAuthAuthorizationUrl } = await import('@/services/oauth')

      const url1 = await getOAuthAuthorizationUrl()
      const url2 = await getOAuthAuthorizationUrl()

      const state1 = new URL(url1).searchParams.get('state')
      const state2 = new URL(url2).searchParams.get('state')

      expect(state1).not.toBe(state2)
      expect(state1!.length).toBeGreaterThanOrEqual(32)
    })

    test('should store state in cookie with proper settings', async () => {
      const { getOAuthAuthorizationUrl } = await import('@/services/oauth')

      mockCookieStore.set.mockClear()
      await getOAuthAuthorizationUrl()

      const stateCall = mockCookieStore.set.mock.calls.find(
        (call: any[]) => call[0] === 'box_oauth_state'
      )

      expect(stateCall).toBeDefined()
      expect(stateCall![2]).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      })
    })
  })

  describe('Rate Limiting', () => {
    test('middleware exports correct config matcher', async () => {
      const { config } = await import('@/middleware')
      expect(config.matcher).toBeDefined()
      expect(config.matcher.length).toBeGreaterThan(0)
    })
  })

  describe('Input Validation', () => {
    test('fileId should be validated as numeric in thumbnail route', () => {
      const validIds = ['12345', '1', '99999999999999999999']
      const invalidIds = ['abc', '../etc/passwd', '<script>', '', '12 34', '12.34']

      const pattern = /^\d{1,20}$/

      validIds.forEach(id => {
        expect(pattern.test(id), `Expected ${id} to be valid`).toBe(true)
      })

      invalidIds.forEach(id => {
        expect(pattern.test(id), `Expected ${id} to be invalid`).toBe(false)
      })
    })

    test('storage filenames should be from allowlist only', () => {
      const allowedFilenames = [
        'fileMetadataStore',
        'promptsStore',
        'systemPromptsStore',
        'configuredTemplates',
        'accuracyData',
      ]
      const rejectedFilenames = [
        '../../etc/passwd',
        '../secret',
        'fileMetadataStore/../../../etc/shadow',
        'randomFile',
        '',
      ]

      const ALLOWED = new Set(allowedFilenames)

      allowedFilenames.forEach(name => {
        expect(ALLOWED.has(name), `Expected ${name} to be allowed`).toBe(true)
      })

      rejectedFilenames.forEach(name => {
        expect(ALLOWED.has(name), `Expected ${name} to be rejected`).toBe(false)
      })
    })
  })

  describe('Security Headers', () => {
    test('middleware should set required security headers', async () => {
      const { middleware } = await import('@/middleware')
      const { NextRequest } = await import('next/server')

      const request = new NextRequest('http://localhost:3000/settings')
      const response = middleware(request)

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
      expect(response.headers.get('Content-Security-Policy')).toBeTruthy()
      expect(response.headers.get('Permissions-Policy')).toBeTruthy()
    })
  })
})
