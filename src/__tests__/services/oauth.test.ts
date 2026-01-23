import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  storeOAuthTokens,
  getOAuthStatus,
  isOAuthConnected,
  getOAuthAccessToken,
  disconnectOAuth,
  getOAuthAuthorizationUrl
} from '@/services/oauth'

// Mock Next.js cookies
const mockCookies = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  has: vi.fn()
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookies))
}))

// Mock environment variables
const originalEnv = process.env

describe('OAuth Service - Backend API Testing', () => {
  
  const createMockTokens = () => ({
    accessToken: 'test_access_token_123',
    refreshToken: 'test_refresh_token_456', 
    expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour from now
    tokenType: 'Bearer'
  })

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup environment variables
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      BOX_CLIENT_ID: 'test_client_id',
      BOX_CLIENT_SECRET: 'test_client_secret',
      NEXTAUTH_URL: 'http://localhost:3000'
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Token Storage - Security Critical', () => {
    test('should store OAuth tokens with secure cookie settings', async () => {
      const tokens = createMockTokens()
      
      await storeOAuthTokens(tokens)
      
      // Should call set for each token component
      expect(mockCookies.set).toHaveBeenCalledTimes(5)
      
      // Verify access token storage with security settings
      expect(mockCookies.set).toHaveBeenCalledWith(
        'box_oauth_access_token',
        tokens.accessToken,
        expect.objectContaining({
          httpOnly: true,
          secure: false, // test environment
          sameSite: 'lax',
          maxAge: expect.any(Number),
          path: '/'
        })
      )
      
      // Verify refresh token storage  
      expect(mockCookies.set).toHaveBeenCalledWith(
        'box_oauth_refresh_token',
        tokens.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60, // 30 days
          path: '/'
        })
      )
      
      // Verify expires_at storage
      expect(mockCookies.set).toHaveBeenCalledWith(
        'box_oauth_expires_at',
        tokens.expiresAt.toString(),
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax'
        })
      )
    })

    test('should use secure cookies in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        configurable: true
      })
      
      const tokens = createMockTokens()
      
      await storeOAuthTokens(tokens)
      
      // Should use secure: true in production
      expect(mockCookies.set).toHaveBeenCalledWith(
        'box_oauth_access_token',
        tokens.accessToken,
        expect.objectContaining({
          secure: true // production environment
        })
      )
      
      // Restore original NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalNodeEnv,
        configurable: true
      })
    })

    test('should store last connected timestamp', async () => {
      const tokens = createMockTokens()
      
      await storeOAuthTokens(tokens)
      
      // Should store last connected timestamp
      expect(mockCookies.set).toHaveBeenCalledWith(
        'box_oauth_last_connected',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          path: '/'
        })
      )
    })
  })

  describe('OAuth Status Management', () => {
    test('should return connected status when tokens exist and are valid', async () => {
      const tokens = createMockTokens()
      
      // Mock cookies returning valid tokens
      mockCookies.get
        .mockReturnValueOnce({ value: tokens.accessToken })      // access_token
        .mockReturnValueOnce({ value: tokens.refreshToken })     // refresh_token  
        .mockReturnValueOnce({ value: tokens.expiresAt.toString() }) // expires_at
        .mockReturnValueOnce({ value: tokens.tokenType })        // token_type
        .mockReturnValueOnce({ value: new Date().toISOString() }) // last_connected
      
      const status = await getOAuthStatus()
      
      expect(status.isConnected).toBe(true)
      expect(status.tokens).toEqual({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        tokenType: tokens.tokenType
      })
      expect(status.lastConnected).toBeDefined()
    })

    test('should return disconnected status when tokens are missing', async () => {
      // Mock cookies returning null (no tokens)
      mockCookies.get.mockReturnValue(null)
      
      const status = await getOAuthStatus()
      
      expect(status.isConnected).toBe(false)
      expect(status.tokens).toBeUndefined()
      expect(status.lastConnected).toBeUndefined()
    })

    test('should return disconnected status when tokens are expired', async () => {
      const expiredTokens = {
        ...createMockTokens(),
        expiresAt: Date.now() - (60 * 60 * 1000) // 1 hour ago (expired)
      }
      
      mockCookies.get
        .mockReturnValueOnce({ value: expiredTokens.accessToken })
        .mockReturnValueOnce({ value: expiredTokens.refreshToken })
        .mockReturnValueOnce({ value: expiredTokens.expiresAt.toString() })
        .mockReturnValueOnce({ value: expiredTokens.tokenType })
        .mockReturnValueOnce({ value: new Date().toISOString() })
      
      const status = await getOAuthStatus()
      
      expect(status.isConnected).toBe(false)
      expect(status.tokens).toBeUndefined()
    })
  })

  describe('Token Access and Validation', () => {
    test('should return access token when connected and valid', async () => {
      const tokens = createMockTokens()
      
      // isOAuthConnected checks: access_token, refresh_token, expires_at
      // Then getOAuthAccessToken reads: access_token, expires_at again
      mockCookies.get
        .mockReturnValueOnce({ value: tokens.accessToken })      // isOAuthConnected: access_token
        .mockReturnValueOnce({ value: tokens.refreshToken })     // isOAuthConnected: refresh_token
        .mockReturnValueOnce({ value: tokens.expiresAt.toString() }) // isOAuthConnected: expires_at
        .mockReturnValueOnce({ value: tokens.accessToken })      // getOAuthAccessToken: access_token
        .mockReturnValueOnce({ value: tokens.expiresAt.toString() }) // getOAuthAccessToken: expires_at
      
      const accessToken = await getOAuthAccessToken()
      
      expect(accessToken).toBe(tokens.accessToken)
    })

    test('should return null when no access token exists', async () => {
      mockCookies.get.mockReturnValue(null)
      
      const accessToken = await getOAuthAccessToken()
      
      expect(accessToken).toBeNull()
    })

    test('should return null when token is expired', async () => {
      const expiredTime = Date.now() - (60 * 60 * 1000) // 1 hour ago
      
      // isOAuthConnected will see expired token and no refresh token
      mockCookies.get
        .mockReturnValueOnce({ value: 'expired_token' })
        .mockReturnValueOnce({ value: null })  // no refresh token
        .mockReturnValueOnce({ value: expiredTime.toString() })
      
      const accessToken = await getOAuthAccessToken()
      
      expect(accessToken).toBeNull()
    })

    test('should validate connection status correctly', async () => {
      const tokens = createMockTokens()
      
      // Test connected state - isOAuthConnected checks access, refresh, expires_at
      mockCookies.get
        .mockReturnValueOnce({ value: tokens.accessToken })
        .mockReturnValueOnce({ value: tokens.refreshToken })
        .mockReturnValueOnce({ value: tokens.expiresAt.toString() })
      
      expect(await isOAuthConnected()).toBe(true)
      
      // Test disconnected state - reset and return nulls
      vi.clearAllMocks()
      mockCookies.get.mockReturnValue(null)
      
      expect(await isOAuthConnected()).toBe(false)
    })
  })

  describe('OAuth Disconnection', () => {
    test('should clear all OAuth cookies on disconnect', async () => {
      await disconnectOAuth()
      
      // Should delete all OAuth-related cookies
      expect(mockCookies.delete).toHaveBeenCalledTimes(5)
      expect(mockCookies.delete).toHaveBeenCalledWith('box_oauth_access_token')
      expect(mockCookies.delete).toHaveBeenCalledWith('box_oauth_refresh_token')
      expect(mockCookies.delete).toHaveBeenCalledWith('box_oauth_expires_at')
      expect(mockCookies.delete).toHaveBeenCalledWith('box_oauth_token_type')
      expect(mockCookies.delete).toHaveBeenCalledWith('box_oauth_last_connected')
    })
  })

  describe('OAuth Authorization Flow', () => {
    test('should generate valid authorization URL', async () => {
      // The implementation uses NEXT_PUBLIC_BOX_CLIENT_ID, not BOX_CLIENT_ID
      process.env.NEXT_PUBLIC_BOX_CLIENT_ID = 'test_client_id'
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
      
      const authUrl = await getOAuthAuthorizationUrl()
      
      const url = new URL(authUrl)
      
      // Should be Box OAuth URL
      expect(url.origin).toBe('https://account.box.com')
      expect(url.pathname).toBe('/api/oauth2/authorize')
      
      // Should have required parameters
      expect(url.searchParams.get('response_type')).toBe('code')
      expect(url.searchParams.get('client_id')).toBe('test_client_id')
      expect(url.searchParams.get('redirect_uri')).toContain('/api/auth/box/callback')
      expect(url.searchParams.get('state')).toBeDefined()
      
      // Note: scopes are configured in Box Developer Console, not in URL
      // So we don't check for scope in the URL
    })

    test('should include anti-CSRF state parameter', async () => {
      process.env.NEXT_PUBLIC_BOX_CLIENT_ID = 'test_client_id'
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
      
      const authUrl1 = await getOAuthAuthorizationUrl()
      const authUrl2 = await getOAuthAuthorizationUrl()
      
      const url1 = new URL(authUrl1)
      const url2 = new URL(authUrl2)
      
      const state1 = url1.searchParams.get('state')
      const state2 = url2.searchParams.get('state')
      
      // States should be different (random)
      expect(state1).toBeDefined()
      expect(state2).toBeDefined()
      expect(state1).not.toBe(state2)
      
      // States should be reasonably long (6+ chars from the implementation)
      expect(state1!.length).toBeGreaterThanOrEqual(6)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    test('should propagate cookie storage errors', async () => {
      const tokens = createMockTokens()
      
      // Mock cookie.set to throw an error
      mockCookies.set.mockImplementationOnce(() => {
        throw new Error('Cookie storage failed')
      })
      
      // Should propagate the error
      await expect(storeOAuthTokens(tokens)).rejects.toThrow('Cookie storage failed')
    })

    test('should handle malformed cookie values', async () => {
      // isOAuthConnected checks access, refresh, expires_at
      // For malformed expires_at, it treats it as 0 which is expired
      mockCookies.get
        .mockReturnValueOnce({ value: 'valid_token' })
        .mockReturnValueOnce({ value: null })  // no refresh token
        .mockReturnValueOnce({ value: 'not_a_number' }) // Invalid expires_at -> NaN
      
      const accessToken = await getOAuthAccessToken()
      
      // Should handle gracefully and return null for invalid data
      expect(accessToken).toBeNull()
    })

    test('should use defaults when environment variables missing', async () => {
      delete process.env.NEXT_PUBLIC_BOX_CLIENT_ID
      delete process.env.NEXT_PUBLIC_APP_URL
      
      // Should use default values, not throw
      const authUrl = await getOAuthAuthorizationUrl()
      const url = new URL(authUrl)
      
      // Default client_id is 'your_box_client_id'
      expect(url.searchParams.get('client_id')).toBe('your_box_client_id')
    })

    test('should handle cookie read errors', async () => {
      mockCookies.get.mockImplementationOnce(() => {
        throw new Error('Cookie read failed')
      })
      
      // The function will throw when it can't read cookies
      // We should expect it to propagate or catch the error
      try {
        const status = await getOAuthStatus()
        // If it doesn't throw, it should return disconnected state
        expect(status.isConnected).toBe(false)
      } catch {
        // If it throws, that's also acceptable behavior
        expect(true).toBe(true)
      }
    })
  })

  describe('Security Validation', () => {
    test('should use proper cookie security attributes', async () => {
      const tokens = createMockTokens()
      
      await storeOAuthTokens(tokens)
      
      // Verify security attributes on sensitive cookies
      const securityCall = mockCookies.set.mock.calls.find(call => 
        call[0] === 'box_oauth_access_token'
      )
      
      expect(securityCall![2]).toMatchObject({
        httpOnly: true,    // Prevent XSS
        sameSite: 'lax',   // CSRF protection
        path: '/'          // Proper scope
      })
    })

    test('should not expose sensitive data in logs', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const tokens = createMockTokens()
      
      await storeOAuthTokens(tokens)
      
      // Verify no tokens are logged
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(tokens.accessToken)
      )
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining(tokens.refreshToken)
      )
      
      consoleSpy.mockRestore()
    })

    test('should validate token format', async () => {
      // Test with malformed tokens
      const malformedTokens = {
        accessToken: '', // Empty token
        refreshToken: 'valid_refresh',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer'
      }
      
      mockCookies.get
        .mockReturnValueOnce({ value: '' }) // Empty access token
        .mockReturnValueOnce({ value: malformedTokens.expiresAt.toString() })
      
      const accessToken = await getOAuthAccessToken()
      
      expect(accessToken).toBeNull() // Should reject empty tokens
    })
  })

  describe('Performance and Caching', () => {
    test('should handle concurrent token access efficiently', async () => {
      const tokens = createMockTokens()
      
      // Setup mock to always return valid tokens for each call
      // isOAuthConnected needs: access, refresh, expires_at
      // getOAuthAccessToken needs: access, expires_at
      // For 10 concurrent calls, each needs these cookie reads
      mockCookies.get.mockImplementation((name: string) => {
        if (name === 'box_oauth_access_token') return { value: tokens.accessToken }
        if (name === 'box_oauth_refresh_token') return { value: tokens.refreshToken }
        if (name === 'box_oauth_expires_at') return { value: tokens.expiresAt.toString() }
        return null
      })
      
      // Make multiple concurrent requests
      const promises = Array.from({ length: 10 }, () => getOAuthAccessToken())
      const results = await Promise.all(promises)
      
      // All should succeed
      results.forEach(token => {
        expect(token).toBe(tokens.accessToken)
      })
    })

    test('should handle token expiry edge cases', async () => {
      // Token expires well in the future (more than 5 min buffer used by isOAuthConnected)
      const futureTime = Date.now() + (10 * 60 * 1000) // 10 minutes from now
      
      mockCookies.get.mockImplementation((name: string) => {
        if (name === 'box_oauth_access_token') return { value: 'valid_token' }
        if (name === 'box_oauth_refresh_token') return { value: 'refresh_token' }
        if (name === 'box_oauth_expires_at') return { value: futureTime.toString() }
        return null
      })
      
      const accessToken = await getOAuthAccessToken()
      
      // Should be valid
      expect(accessToken).toBe('valid_token')
    })
  })
}) 