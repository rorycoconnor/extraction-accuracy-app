import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/auth/box/callback/route'

// Mock OAuth service
vi.mock('@/services/oauth', () => ({
  storeOAuthTokens: vi.fn()
}))

// Mock fetch for Box API calls
global.fetch = vi.fn()

const originalEnv = process.env

describe('Box OAuth Callback API Route', () => {
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    process.env = {
      ...originalEnv,
      BOX_CLIENT_ID: 'test_client_id',
      BOX_CLIENT_SECRET: 'test_client_secret'
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const createMockRequest = (params: Record<string, string>) => {
    const url = new URL('http://localhost:3000/api/auth/box/callback')
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
    
    return new NextRequest(url)
  }

  describe('Successful OAuth Flow', () => {
    test('should handle successful authorization code exchange', async () => {
      const { storeOAuthTokens } = await import('@/services/oauth')
      
      // Mock successful token exchange response from Box
      const mockTokenResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      }
      
      vi.mocked(fetch).mockResolvedValue(mockTokenResponse as any)
      vi.mocked(storeOAuthTokens).mockResolvedValue()
      
      const request = createMockRequest({
        code: 'valid_auth_code',
        state: 'random_state_value'
      })
      
      const response = await GET(request)
      
      // Should exchange code for tokens
      expect(fetch).toHaveBeenCalledWith(
        'https://api.box.com/oauth2/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          }),
          body: expect.stringContaining('grant_type=authorization_code')
        })
      )
      
      // Should store tokens securely
      expect(storeOAuthTokens).toHaveBeenCalledWith({
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: expect.any(Number),
        tokenType: 'Bearer'
      })
      
      // Should redirect to settings with success
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toContain('/settings?success=oauth_connected')
    })

    test('should calculate correct token expiry time', async () => {
      const { storeOAuthTokens } = await import('@/services/oauth')
      
      const beforeTime = Date.now()
      
      const mockTokenResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          access_token: 'test_token',
          refresh_token: 'test_refresh',
          expires_in: 7200, // 2 hours
          token_type: 'Bearer'
        })
      }
      
      vi.mocked(fetch).mockResolvedValue(mockTokenResponse as any)
      vi.mocked(storeOAuthTokens).mockResolvedValue()
      
      const request = createMockRequest({
        code: 'valid_code',
        state: 'state'
      })
      
      await GET(request)
      
      const afterTime = Date.now()
      
      // Should calculate expiry correctly (now + expires_in * 1000)
      const storedTokens = vi.mocked(storeOAuthTokens).mock.calls[0][0]
      expect(storedTokens.expiresAt).toBeGreaterThan(beforeTime + 7200 * 1000 - 1000) // Allow 1s variance
      expect(storedTokens.expiresAt).toBeLessThan(afterTime + 7200 * 1000 + 1000)
    })
  })

  describe('Error Handling', () => {
    test('should handle OAuth error responses', async () => {
      const request = createMockRequest({
        error: 'access_denied',
        error_description: 'User denied authorization'
      })
      
      const response = await GET(request)
      
      // Should redirect with error
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toContain('/settings?error=oauth_failed')
      expect(response.headers.get('Location')).toContain('message=access_denied')
      
      // Should not make token exchange request
      expect(fetch).not.toHaveBeenCalled()
    })

    test('should handle missing authorization code', async () => {
      const request = createMockRequest({
        state: 'some_state'
        // Missing 'code' parameter
      })
      
      const response = await GET(request)
      
      // Should redirect with missing code error
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toContain('/settings?error=oauth_failed')
      expect(response.headers.get('Location')).toContain('message=missing_code')
      
      expect(fetch).not.toHaveBeenCalled()
    })

    test('should handle Box API token exchange failures', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'Authorization code is invalid or expired'
        })
      }
      
      vi.mocked(fetch).mockResolvedValue(mockErrorResponse as any)
      
      const request = createMockRequest({
        code: 'invalid_code',
        state: 'state'
      })
      
      const response = await GET(request)
      
      // Should redirect with token exchange error
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toContain('/settings?error=oauth_failed')
      expect(response.headers.get('Location')).toContain('message=token_exchange_failed')
    })

    test('should handle network errors during token exchange', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
      
      const request = createMockRequest({
        code: 'valid_code',
        state: 'state'
      })
      
      const response = await GET(request)
      
      // Should redirect with network error
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toContain('/settings?error=oauth_failed')
      expect(response.headers.get('Location')).toContain('message=network_error')
    })

    test('should handle token storage failures', async () => {
      const { storeOAuthTokens } = await import('@/services/oauth')
      
      const mockTokenResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          access_token: 'valid_token',
          refresh_token: 'valid_refresh',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      }
      
      vi.mocked(fetch).mockResolvedValue(mockTokenResponse as any)
      vi.mocked(storeOAuthTokens).mockRejectedValue(new Error('Cookie storage failed'))
      
      const request = createMockRequest({
        code: 'valid_code',
        state: 'state'
      })
      
      const response = await GET(request)
      
      // Should redirect with storage error
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toContain('/settings?error=oauth_failed')
      expect(response.headers.get('Location')).toContain('message=storage_error')
    })
  })

  describe('Security Validation', () => {
    test('should validate required environment variables', async () => {
      delete process.env.BOX_CLIENT_ID
      delete process.env.BOX_CLIENT_SECRET
      
      const request = createMockRequest({
        code: 'valid_code',
        state: 'state'
      })
      
      const response = await GET(request)
      
      // Should handle missing config gracefully
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toContain('/settings?error=oauth_failed')
      expect(response.headers.get('Location')).toContain('message=configuration_error')
    })

    test('should include CSRF state validation (when implemented)', async () => {
      // This test documents expected behavior for state validation
      const request = createMockRequest({
        code: 'valid_code',
        state: 'potentially_malicious_state'
      })
      
      // Current implementation doesn't validate state, but should redirect successfully
      // In a production environment, state validation would be critical
      const response = await GET(request)
      
      // Should process request (current behavior)
      // TODO: In production, this should validate state parameter
      expect(response.status).toBe(302)
    })

    test('should use secure redirect URLs', async () => {
      const request = createMockRequest({
        code: 'valid_code',
        state: 'state'
      })
      
      const response = await GET(request)
      
      const location = response.headers.get('Location')
      
      // Should redirect to same origin only
      expect(location).not.toContain('http://malicious-site.com')
      expect(location).toMatch(/^\/settings/)
    })

    test('should send correct authentication to Box API', async () => {
      const mockTokenResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      }
      
      vi.mocked(fetch).mockResolvedValue(mockTokenResponse as any)
      
      const request = createMockRequest({
        code: 'auth_code',
        state: 'state'
      })
      
      await GET(request)
      
      // Should send proper client credentials to Box
      const fetchCall = vi.mocked(fetch).mock.calls[0]
      const requestBody = fetchCall[1]?.body as string
      
      expect(requestBody).toContain('client_id=test_client_id')
      expect(requestBody).toContain('client_secret=test_client_secret')
      expect(requestBody).toContain('code=auth_code')
      expect(requestBody).toContain('grant_type=authorization_code')
    })
  })

  describe('Response Format Validation', () => {
    test('should handle Box API responses with different token types', async () => {
      const { storeOAuthTokens } = await import('@/services/oauth')
      
      const mockTokenResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          access_token: 'access_token',
          refresh_token: 'refresh_token',
          expires_in: 7200,
          token_type: 'bearer' // lowercase
        })
      }
      
      vi.mocked(fetch).mockResolvedValue(mockTokenResponse as any)
      vi.mocked(storeOAuthTokens).mockResolvedValue()
      
      const request = createMockRequest({
        code: 'code',
        state: 'state'
      })
      
      await GET(request)
      
      // Should normalize token type
      expect(storeOAuthTokens).toHaveBeenCalledWith({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: expect.any(Number),
        tokenType: 'bearer'
      })
    })

    test('should handle malformed JSON from Box API', async () => {
      const mockBadResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      }
      
      vi.mocked(fetch).mockResolvedValue(mockBadResponse as any)
      
      const request = createMockRequest({
        code: 'code',
        state: 'state'
      })
      
      const response = await GET(request)
      
      // Should handle JSON parsing error
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toContain('/settings?error=oauth_failed')
      expect(response.headers.get('Location')).toContain('message=invalid_response')
    })
  })
}) 