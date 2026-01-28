import { describe, it, expect } from 'vitest'

/**
 * Tests for useApiError composable
 */

import { extractApiError } from '~/composables/useApiError'

// ============================================================================
// Tests: extractApiError
// ============================================================================

describe('extractApiError', () => {
  describe('nested data.message pattern', () => {
    it('should extract message from error.data.message', () => {
      const error = {
        data: {
          message: 'Validation failed',
        },
      }

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Validation failed')
    })

    it('should prefer data.message over top-level message', () => {
      const error = {
        message: 'Top level error',
        data: {
          message: 'Nested error message',
        },
      }

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Nested error message')
    })

    it('should handle data.message with empty string', () => {
      const error = {
        data: {
          message: '',
        },
      }

      const result = extractApiError(error, 'Default')

      expect(typeof result).toBe('string')
    })
  })

  describe('top-level message pattern', () => {
    it('should extract message from error.message', () => {
      const error = {
        message: 'Something went wrong',
      }

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Something went wrong')
    })

    it('should handle Error instances', () => {
      const error = new Error('Standard error')

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Standard error')
    })

    it('should use message when data exists but has no message', () => {
      const error = {
        message: 'Fallback to message',
        data: {
          statusCode: 400,
        },
      }

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Fallback to message')
    })
  })

  describe('fallback behavior', () => {
    it('should return fallback for null error', () => {
      const result = extractApiError(null, 'Default error')

      expect(result).toBe('Default error')
    })

    it('should return fallback for undefined error', () => {
      const result = extractApiError(undefined, 'Default error')

      expect(result).toBe('Default error')
    })

    it('should return fallback for primitive string error', () => {
      const result = extractApiError('string error', 'Default error')

      expect(result).toBe('Default error')
    })

    it('should return fallback for primitive number error', () => {
      const result = extractApiError(42, 'Default error')

      expect(result).toBe('Default error')
    })

    it('should return fallback for primitive boolean error', () => {
      const result = extractApiError(true, 'Default error')

      expect(result).toBe('Default error')
    })

    it('should return fallback for empty object', () => {
      const result = extractApiError({}, 'Default error')

      expect(result).toBe('Default error')
    })

    it('should return fallback when data is null', () => {
      const error = {
        data: null,
      }

      const result = extractApiError(error, 'Default error')

      expect(result).toBe('Default error')
    })

    it('should return fallback when data.message is not a string', () => {
      const error = {
        data: {
          message: { nested: 'object' },
        },
      }

      const result = extractApiError(error, 'Default error')

      expect(result).toBe('Default error')
    })

    it('should return fallback when message is not a string', () => {
      const error = {
        message: 123,
      }

      const result = extractApiError(error, 'Default error')

      expect(result).toBe('Default error')
    })
  })

  describe('Nuxt/Nitro error patterns', () => {
    it('should handle Nuxt $fetch error format', () => {
      const error = {
        statusCode: 400,
        data: {
          statusCode: 400,
          message: 'Bad Request',
        },
      }

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Bad Request')
    })

    it('should handle Nitro createError format', () => {
      const error = {
        statusCode: 401,
        message: 'Unauthorized',
        data: null,
      }

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Unauthorized')
    })

    it('should handle validation error with details', () => {
      const error = {
        data: {
          statusCode: 422,
          message: 'Email is required',
          errors: [{ field: 'email', message: 'Required' }],
        },
      }

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Email is required')
    })

    it('should handle network error', () => {
      const error = new TypeError('Failed to fetch')

      const result = extractApiError(error, 'Network error')

      expect(result).toBe('Failed to fetch')
    })
  })

  describe('edge cases', () => {
    it('should handle error with circular reference', () => {
      const error: Record<string, unknown> = {
        message: 'Circular error',
      }
      error.self = error

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Circular error')
    })

    it('should handle deeply nested data structure', () => {
      const error = {
        data: {
          data: {
            message: 'Deeply nested',
          },
          message: 'First level message',
        },
      }

      const result = extractApiError(error, 'Default')

      expect(result).toBe('First level message')
    })

    it('should handle array error (not object)', () => {
      const error = ['error1', 'error2']

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Default')
    })

    it('should handle function as error', () => {
      const error = () => 'function error'

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Default')
    })

    it('should handle Symbol as error property', () => {
      const error = {
        message: Symbol('error'),
      }

      const result = extractApiError(error, 'Default')

      expect(result).toBe('Default')
    })
  })

  describe('common API error messages', () => {
    it('should extract authentication errors', () => {
      const error = {
        data: {
          message: 'Invalid credentials',
          statusCode: 401,
        },
      }

      const result = extractApiError(error, 'Login failed')

      expect(result).toBe('Invalid credentials')
    })

    it('should extract authorization errors', () => {
      const error = {
        data: {
          message: 'Insufficient permissions',
          statusCode: 403,
        },
      }

      const result = extractApiError(error, 'Access denied')

      expect(result).toBe('Insufficient permissions')
    })

    it('should extract not found errors', () => {
      const error = {
        data: {
          message: 'Item not found',
          statusCode: 404,
        },
      }

      const result = extractApiError(error, 'Not found')

      expect(result).toBe('Item not found')
    })

    it('should extract server errors', () => {
      const error = {
        data: {
          message: 'Internal server error',
          statusCode: 500,
        },
      }

      const result = extractApiError(error, 'Server error')

      expect(result).toBe('Internal server error')
    })

    it('should extract rate limit errors', () => {
      const error = {
        data: {
          message: 'Too many requests, please try again later',
          statusCode: 429,
        },
      }

      const result = extractApiError(error, 'Rate limited')

      expect(result).toBe('Too many requests, please try again later')
    })
  })

  describe('fallback message variations', () => {
    it('should use custom fallback for authentication operations', () => {
      const result = extractApiError(null, 'Authentication failed. Please try again.')

      expect(result).toBe('Authentication failed. Please try again.')
    })

    it('should use custom fallback for save operations', () => {
      const result = extractApiError(null, 'Failed to save changes')

      expect(result).toBe('Failed to save changes')
    })

    it('should use custom fallback for delete operations', () => {
      const result = extractApiError(null, 'Failed to delete item')

      expect(result).toBe('Failed to delete item')
    })

    it('should use custom fallback for fetch operations', () => {
      const result = extractApiError(null, 'Failed to load data')

      expect(result).toBe('Failed to load data')
    })
  })
})
