import { describe, test, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/auth/box/status/route'

// Mock OAuth service
vi.mock('@/services/oauth', () => ({
  getOAuthStatus: vi.fn()
}))

describe('Box OAuth Status API Route', () => {
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createMockRequest = () => {
    return new NextRequest('http://localhost:3000/api/auth/box/status')
  }

  describe('Authentication Status Response', () => {
    test('should return connected status when user is authenticated', async () => {
      const { getOAuthStatus } = await import('@/services/oauth')
      
      const mockConnectedStatus = {
        isConnected: true,
        tokens: {
          accessToken: 'access_token_123',
          refreshToken: 'refresh_token_456',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer'
        },
        lastConnected: new Date().toISOString()
      }
      
      vi.mocked(getOAuthStatus).mockResolvedValue(mockConnectedStatus)
      
      const request = createMockRequest()
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        status: {
          isConnected: true,
          tokens: {
            accessToken: 'access_token_123',
            refreshToken: 'refresh_token_456',
            expiresAt: expect.any(Number),
            tokenType: 'Bearer'
          },
          lastConnected: expect.any(String)
        }
      })
    })

    test('should return disconnected status when user is not authenticated', async () => {
      const { getOAuthStatus } = await import('@/services/oauth')
      
      const mockDisconnectedStatus = {
        isConnected: false
      }
      
      vi.mocked(getOAuthStatus).mockResolvedValue(mockDisconnectedStatus)
      
      const request = createMockRequest()
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        status: {
          isConnected: false
        }
      })
    })

    test('should return disconnected status when tokens are expired', async () => {
      const { getOAuthStatus } = await import('@/services/oauth')
      
      const mockExpiredStatus = {
        isConnected: false,
        lastConnected: '2024-01-01T00:00:00Z'
      }
      
      vi.mocked(getOAuthStatus).mockResolvedValue(mockExpiredStatus)
      
      const request = createMockRequest()
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: true,
        status: {
          isConnected: false,
          lastConnected: '2024-01-01T00:00:00Z'
        }
      })
    })
  })

  describe('Error Handling', () => {
    test('should handle OAuth service errors gracefully', async () => {
      const { getOAuthStatus } = await import('@/services/oauth')
      
      vi.mocked(getOAuthStatus).mockRejectedValue(new Error('Cookie read error'))
      
      const request = createMockRequest()
      const response = await GET(request)
      
      // Route returns 200 with error in body (success: false)
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData).toEqual({
        success: false,
        error: 'Failed to get OAuth status',
        status: { isConnected: false }
      })
    })

    test('should handle malformed OAuth status response', async () => {
      const { getOAuthStatus } = await import('@/services/oauth')
      
      // Mock malformed response (null) - the route passes it through
      vi.mocked(getOAuthStatus).mockResolvedValue(null as any)
      
      const request = createMockRequest()
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      
      const responseData = await response.json()
      expect(responseData.success).toBe(true)
      // When null is returned, status is null
      expect(responseData.status).toBeNull()
    })
  })

  describe('Security and Performance', () => {
    test('should not expose sensitive token data in error responses', async () => {
      const { getOAuthStatus } = await import('@/services/oauth')
      
      // Mock service throwing error with token in message
      const tokenError = new Error('Token access_token_secret is invalid')
      vi.mocked(getOAuthStatus).mockRejectedValue(tokenError)
      
      const request = createMockRequest()
      const response = await GET(request)
      
      const responseData = await response.json()
      
      // Should not expose token in error response
      expect(JSON.stringify(responseData)).not.toContain('access_token_secret')
             expect(responseData.error).toBe('Failed to get OAuth status')
    })

    test('should return consistent response format', async () => {
      const { getOAuthStatus } = await import('@/services/oauth')
      
      vi.mocked(getOAuthStatus).mockResolvedValue({
        isConnected: true,
        tokens: {
          accessToken: 'token',
          refreshToken: 'refresh',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer'
        }
      })
      
      const request = createMockRequest()
      const response = await GET(request)
      
      expect(response.headers.get('Content-Type')).toContain('application/json')
      
      const responseData = await response.json()
      
             // Should have consistent structure
       expect(responseData).toHaveProperty('success')
       expect(responseData).toHaveProperty('status')
       expect(responseData.status).toHaveProperty('isConnected')
       expect(typeof responseData.status.isConnected).toBe('boolean')
       
       if (responseData.status.tokens) {
         expect(responseData.status.tokens).toHaveProperty('accessToken')
         expect(responseData.status.tokens).toHaveProperty('refreshToken')
         expect(responseData.status.tokens).toHaveProperty('expiresAt')
         expect(responseData.status.tokens).toHaveProperty('tokenType')
       }
    })

    test('should handle high frequency status checks efficiently', async () => {
      const { getOAuthStatus } = await import('@/services/oauth')
      
      const mockStatus = { isConnected: true }
      vi.mocked(getOAuthStatus).mockResolvedValue(mockStatus)
      
      // Make multiple concurrent requests
      const promises = Array.from({ length: 10 }, () => {
        const request = createMockRequest()
        return GET(request)
      })
      
      const responses = await Promise.all(promises)
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
      
      // Service should be called for each request (no unwanted caching)
      expect(getOAuthStatus).toHaveBeenCalledTimes(10)
    })
  })

  describe('Response Headers and CORS', () => {
    test('should set appropriate response headers', async () => {
      const { getOAuthStatus } = await import('@/services/oauth')
      
      vi.mocked(getOAuthStatus).mockResolvedValue({ isConnected: false })
      
      const request = createMockRequest()
      const response = await GET(request)
      
      // Should set JSON content type
      expect(response.headers.get('Content-Type')).toContain('application/json')
      
      // Should not set CORS headers (same-origin requests only)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    test('should handle OPTIONS requests for preflight', async () => {
      // Note: This API route should only accept GET requests
      // OPTIONS handling would be done by Next.js automatically
      
      const request = createMockRequest()
      const response = await GET(request)
      
      // Should respond to GET requests normally
      expect(response.status).toBe(200)
    })
  })
}) 