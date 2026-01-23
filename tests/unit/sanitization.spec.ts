import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * TDD Tests for Import Data Sanitization Utilities
 *
 * These tests are written BEFORE the implementation exists (RED phase).
 * The sanitization module should be created at: server/utils/sanitization.ts
 *
 * Expected exports from server/utils/sanitization.ts:
 * - sanitizeString(value: any): string
 * - sanitizeNumber(value: any): SanitizeResult<number>
 * - sanitizeDate(value: any): SanitizeResult<string>
 * - sanitizeCurrency(value: any): SanitizeResult<number>
 * - sanitizeCell(value: any, type: ColumnType): SanitizeResult<any>
 * - sanitizeRow(row: Record<string, unknown>, columns: ColumnDefinition[]): SanitizeRowResult
 */

// Import types that will be used
import type { ColumnType, ColumnDefinition } from '~/types/schema'

// Import the actual implementation
import {
  sanitizeString,
  sanitizeNumber,
  sanitizeDate,
  sanitizeCurrency,
  sanitizeCell,
  sanitizeRow,
  type SanitizeResult,
  type SanitizeRowResult,
} from '~/server/utils/sanitization'

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a mock column definition for testing
 */
function createColumn(overrides: Partial<ColumnDefinition> = {}): ColumnDefinition {
  return {
    id: crypto.randomUUID(),
    name: 'Test Column',
    type: 'text',
    order: 0,
    ...overrides,
  }
}

// ============================================================================
// Tests: sanitizeString
// ============================================================================

describe('sanitizeString', () => {
  describe('Whitespace Handling', () => {
    it('should trim leading and trailing whitespace', () => {
      expect(sanitizeString('  test  ')).toBe('test')
    })

    it('should normalize multiple spaces to single space', () => {
      expect(sanitizeString('   Hello    World ')).toBe('Hello World')
    })

    it('should handle multiple internal spaces', () => {
      expect(sanitizeString('one   two    three')).toBe('one two three')
    })

    it('should return empty string for whitespace-only input', () => {
      expect(sanitizeString('   ')).toBe('')
    })

    it('should return empty string for empty string input', () => {
      expect(sanitizeString('')).toBe('')
    })

    it('should handle tabs', () => {
      expect(sanitizeString('tab\there')).toBe('tab here')
    })

    it('should convert newlines to spaces', () => {
      expect(sanitizeString('line1\nline2')).toBe('line1 line2')
    })

    it('should handle carriage returns', () => {
      expect(sanitizeString('line1\r\nline2')).toBe('line1 line2')
    })

    it('should handle mixed whitespace characters', () => {
      expect(sanitizeString('  hello\t\nworld  ')).toBe('hello world')
    })
  })

  describe('Type Coercion', () => {
    it('should convert null to empty string', () => {
      expect(sanitizeString(null)).toBe('')
    })

    it('should convert undefined to empty string', () => {
      expect(sanitizeString(undefined)).toBe('')
    })

    it('should convert numbers to string', () => {
      expect(sanitizeString(123)).toBe('123')
    })

    it('should convert zero to string', () => {
      expect(sanitizeString(0)).toBe('0')
    })

    it('should convert negative numbers to string', () => {
      expect(sanitizeString(-42)).toBe('-42')
    })

    it('should convert floating point numbers to string', () => {
      expect(sanitizeString(3.14159)).toBe('3.14159')
    })

    it('should convert boolean true to string', () => {
      expect(sanitizeString(true)).toBe('true')
    })

    it('should convert boolean false to string', () => {
      expect(sanitizeString(false)).toBe('false')
    })
  })

  describe('Special Characters', () => {
    it('should preserve special characters', () => {
      expect(sanitizeString('special!@#chars')).toBe('special!@#chars')
    })

    it('should preserve unicode characters', () => {
      expect(sanitizeString('Hello, \u4E16\u754C!')).toBe('Hello, \u4E16\u754C!')
    })

    it('should preserve currency symbols', () => {
      expect(sanitizeString('Price: $100')).toBe('Price: $100')
    })

    it('should preserve accented characters', () => {
      expect(sanitizeString('cafe avec cafe')).toBe('cafe avec cafe')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000)
      expect(sanitizeString(longString)).toBe(longString)
    })

    it('should handle strings with only special characters', () => {
      expect(sanitizeString('!@#$%^&*()')).toBe('!@#$%^&*()')
    })

    it('should handle strings with only numbers', () => {
      expect(sanitizeString('12345')).toBe('12345')
    })
  })
})

// ============================================================================
// Tests: sanitizeNumber
// ============================================================================

describe('sanitizeNumber', () => {
  describe('Clean Number Inputs (no warning)', () => {
    it('should parse clean integer string', () => {
      const result = sanitizeNumber('123')
      expect(result).toEqual({ value: 123, warning: false })
    })

    it('should parse string with leading/trailing whitespace', () => {
      const result = sanitizeNumber('  123  ')
      expect(result).toEqual({ value: 123, warning: false })
    })

    it('should preserve negative numbers', () => {
      const result = sanitizeNumber('-123')
      expect(result).toEqual({ value: -123, warning: false })
    })

    it('should parse clean decimal string', () => {
      const result = sanitizeNumber('3.14')
      expect(result).toEqual({ value: 3.14, warning: false })
    })

    it('should handle number type input directly', () => {
      const result = sanitizeNumber(42)
      expect(result).toEqual({ value: 42, warning: false })
    })

    it('should handle zero', () => {
      const result = sanitizeNumber(0)
      expect(result).toEqual({ value: 0, warning: false })
    })

    it('should handle string zero', () => {
      const result = sanitizeNumber('0')
      expect(result).toEqual({ value: 0, warning: false })
    })

    it('should handle negative decimal', () => {
      const result = sanitizeNumber('-3.14')
      expect(result).toEqual({ value: -3.14, warning: false })
    })
  })

  describe('Number Extraction with Warning', () => {
    it('should extract number from alphanumeric prefix', () => {
      const result = sanitizeNumber('aa3')
      expect(result).toEqual({ value: 3, warning: true, warningType: 'number_extraction' })
    })

    it('should extract number from alphanumeric suffix', () => {
      const result = sanitizeNumber('3abc')
      expect(result).toEqual({ value: 3, warning: true, warningType: 'number_extraction' })
    })

    it('should extract number from middle of text', () => {
      const result = sanitizeNumber('abc123def')
      expect(result).toEqual({ value: 123, warning: true, warningType: 'number_extraction' })
    })

    it('should extract decimal from mixed string', () => {
      const result = sanitizeNumber('3.14abc')
      expect(result).toEqual({ value: 3.14, warning: true, warningType: 'number_extraction' })
    })

    it('should handle trailing currency/unit text', () => {
      const result = sanitizeNumber('1234.56USD')
      expect(result).toEqual({ value: 1234.56, warning: true, warningType: 'number_extraction' })
    })

    it('should extract negative number from text', () => {
      const result = sanitizeNumber('value: -42')
      expect(result).toEqual({ value: -42, warning: true, warningType: 'number_extraction' })
    })

    it('should handle multiple numbers (extract first complete number)', () => {
      // When multiple numbers exist, extract the first complete number
      const result = sanitizeNumber('12abc34')
      expect(result.value).toBe(12)
      expect(result.warning).toBe(true)
    })
  })

  describe('Currency and Formatted Numbers (no warning for common formats)', () => {
    it('should handle dollar sign prefix', () => {
      const result = sanitizeNumber('$1,234.56')
      expect(result).toEqual({ value: 1234.56, warning: false })
    })

    it('should handle euro sign prefix', () => {
      const result = sanitizeNumber('\u20AC1,234.56')
      expect(result).toEqual({ value: 1234.56, warning: false })
    })

    it('should handle pound sign prefix', () => {
      const result = sanitizeNumber('\u00A31,234.56')
      expect(result).toEqual({ value: 1234.56, warning: false })
    })

    it('should handle yen sign prefix', () => {
      const result = sanitizeNumber('\u00A51,234')
      expect(result).toEqual({ value: 1234, warning: false })
    })

    it('should handle thousands separators', () => {
      const result = sanitizeNumber('1,234,567')
      expect(result).toEqual({ value: 1234567, warning: false })
    })

    it('should handle negative with currency symbol', () => {
      const result = sanitizeNumber('-$1,234.56')
      expect(result).toEqual({ value: -1234.56, warning: false })
    })

    it('should handle parentheses for negative (accounting format)', () => {
      const result = sanitizeNumber('($1,234.56)')
      expect(result).toEqual({ value: -1234.56, warning: false })
    })

    it('should handle currency symbol after number', () => {
      const result = sanitizeNumber('1,234.56$')
      // This is a less common format, could be warning or not depending on implementation
      expect(result.value).toBe(1234.56)
    })
  })

  describe('Empty and Null Inputs (no warning)', () => {
    it('should return null for empty string', () => {
      const result = sanitizeNumber('')
      expect(result).toEqual({ value: null, warning: false })
    })

    it('should return null for null input', () => {
      const result = sanitizeNumber(null)
      expect(result).toEqual({ value: null, warning: false })
    })

    it('should return null for undefined input', () => {
      const result = sanitizeNumber(undefined)
      expect(result).toEqual({ value: null, warning: false })
    })

    it('should return null for whitespace-only string', () => {
      const result = sanitizeNumber('   ')
      expect(result).toEqual({ value: null, warning: false })
    })
  })

  describe('Invalid Inputs (warning with null)', () => {
    it('should return null with warning for non-numeric string', () => {
      const result = sanitizeNumber('abc')
      expect(result).toEqual({ value: null, warning: true, warningType: 'number_extraction' })
    })

    it('should return null with warning for special characters only', () => {
      const result = sanitizeNumber('!@#$%')
      expect(result).toEqual({ value: null, warning: true, warningType: 'number_extraction' })
    })

    it('should handle NaN result', () => {
      const result = sanitizeNumber(NaN)
      expect(result.value).toBe(null)
    })

    it('should handle Infinity', () => {
      const result = sanitizeNumber(Infinity)
      // Infinity might be treated as invalid or preserved - implementation decision
      expect(result.value).toBe(null)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large numbers', () => {
      const result = sanitizeNumber('9999999999999')
      expect(result.value).toBe(9999999999999)
    })

    it('should handle scientific notation', () => {
      const result = sanitizeNumber('1.5e10')
      expect(result.value).toBe(15000000000)
    })

    it('should handle leading zeros', () => {
      const result = sanitizeNumber('00123')
      expect(result.value).toBe(123)
    })

    it('should handle decimal without leading zero', () => {
      const result = sanitizeNumber('.5')
      expect(result.value).toBe(0.5)
    })

    it('should handle multiple decimal points (take first valid)', () => {
      const result = sanitizeNumber('1.2.3')
      // Should extract 1.2 as the first valid number
      expect(result.value).toBe(1.2)
      expect(result.warning).toBe(true)
    })
  })
})

// ============================================================================
// Tests: sanitizeCurrency
// ============================================================================

describe('sanitizeCurrency', () => {
  describe('Standard Currency Formats', () => {
    it('should parse dollar amount', () => {
      const result = sanitizeCurrency('$1,234.56')
      expect(result).toEqual({ value: 1234.56, warning: false })
    })

    it('should parse euro amount', () => {
      const result = sanitizeCurrency('\u20AC1,234.56')
      expect(result).toEqual({ value: 1234.56, warning: false })
    })

    it('should parse plain number as currency', () => {
      const result = sanitizeCurrency('1234.56')
      expect(result).toEqual({ value: 1234.56, warning: false })
    })

    it('should handle negative currency', () => {
      const result = sanitizeCurrency('-$1,234.56')
      expect(result).toEqual({ value: -1234.56, warning: false })
    })

    it('should handle accounting negative format', () => {
      const result = sanitizeCurrency('($1,234.56)')
      expect(result).toEqual({ value: -1234.56, warning: false })
    })
  })

  describe('Currency with Text (warning)', () => {
    it('should extract currency from text with suffix', () => {
      const result = sanitizeCurrency('$1,234.56 USD')
      expect(result.value).toBe(1234.56)
      expect(result.warning).toBe(true)
    })

    it('should extract currency from price label', () => {
      const result = sanitizeCurrency('Price: $99.99')
      expect(result.value).toBe(99.99)
      expect(result.warning).toBe(true)
    })
  })

  describe('Empty Inputs', () => {
    it('should return null for empty string', () => {
      const result = sanitizeCurrency('')
      expect(result).toEqual({ value: null, warning: false })
    })

    it('should return null for null', () => {
      const result = sanitizeCurrency(null)
      expect(result).toEqual({ value: null, warning: false })
    })
  })

  describe('Precision', () => {
    it('should preserve two decimal places', () => {
      const result = sanitizeCurrency('$10.50')
      expect(result.value).toBe(10.5)
    })

    it('should handle more than two decimal places', () => {
      const result = sanitizeCurrency('$10.999')
      // Could round or preserve - implementation decision
      expect(typeof result.value).toBe('number')
    })

    it('should handle no decimal places', () => {
      const result = sanitizeCurrency('$100')
      expect(result.value).toBe(100)
    })
  })
})

// ============================================================================
// Tests: sanitizeDate
// ============================================================================

describe('sanitizeDate', () => {
  describe('ISO Format (no warning)', () => {
    it('should accept ISO date string', () => {
      const result = sanitizeDate('2024-01-15')
      expect(result.warning).toBe(false)
      expect(result.value).toMatch(/2024-01-15/)
    })

    it('should accept ISO datetime string', () => {
      const result = sanitizeDate('2024-01-15T10:30:00Z')
      expect(result.warning).toBe(false)
      expect(result.value).not.toBe(null)
    })

    it('should normalize to ISO format', () => {
      const result = sanitizeDate('2024-01-15')
      // Result should be ISO string (may include time)
      expect(result.value).toMatch(/^\d{4}-\d{2}-\d{2}/)
    })
  })

  describe('Common Date Formats (no warning)', () => {
    it('should parse MM/DD/YYYY format', () => {
      const result = sanitizeDate('01/15/2024')
      expect(result.warning).toBe(false)
      expect(result.value).not.toBe(null)
      // Should convert to ISO
      expect(result.value).toMatch(/2024-01-15/)
    })

    it('should parse DD/MM/YYYY format when unambiguous', () => {
      // 25/12/2024 is unambiguously day-first
      const result = sanitizeDate('25/12/2024')
      expect(result.warning).toBe(false)
      expect(result.value).toMatch(/2024-12-25/)
    })

    it('should parse long date format', () => {
      const result = sanitizeDate('January 15, 2024')
      expect(result.warning).toBe(false)
      expect(result.value).toMatch(/2024-01-15/)
    })

    it('should parse abbreviated month format', () => {
      const result = sanitizeDate('Jan 15, 2024')
      expect(result.warning).toBe(false)
      expect(result.value).toMatch(/2024-01-15/)
    })

    it('should parse YYYY/MM/DD format', () => {
      const result = sanitizeDate('2024/01/15')
      expect(result.warning).toBe(false)
      expect(result.value).toMatch(/2024-01-15/)
    })
  })

  describe('Date with Time', () => {
    it('should handle date with time', () => {
      const result = sanitizeDate('2024-01-15 10:30:00')
      expect(result.value).not.toBe(null)
    })

    it('should handle 12-hour time format', () => {
      const result = sanitizeDate('January 15, 2024 2:30 PM')
      expect(result.value).not.toBe(null)
    })
  })

  describe('Empty and Null Inputs (no warning)', () => {
    it('should return null for empty string', () => {
      const result = sanitizeDate('')
      expect(result).toEqual({ value: null, warning: false })
    })

    it('should return null for null input', () => {
      const result = sanitizeDate(null)
      expect(result).toEqual({ value: null, warning: false })
    })

    it('should return null for undefined input', () => {
      const result = sanitizeDate(undefined)
      expect(result).toEqual({ value: null, warning: false })
    })

    it('should return null for whitespace-only', () => {
      const result = sanitizeDate('   ')
      expect(result).toEqual({ value: null, warning: false })
    })
  })

  describe('Invalid Dates (warning with null)', () => {
    it('should return null with warning for invalid string', () => {
      const result = sanitizeDate('invalid')
      expect(result).toEqual({ value: null, warning: true, warningType: 'date_parsing' })
    })

    it('should return null with warning for partial date', () => {
      const result = sanitizeDate('2024-13-45') // Invalid month/day
      expect(result).toEqual({ value: null, warning: true, warningType: 'date_parsing' })
    })

    it('should return null with warning for random text', () => {
      const result = sanitizeDate('not a date at all')
      expect(result).toEqual({ value: null, warning: true, warningType: 'date_parsing' })
    })

    it('should return null with warning for numbers only', () => {
      const result = sanitizeDate('12345')
      // Just a number without date context should fail
      expect(result.warning).toBe(true)
    })
  })

  describe('Date Object Input', () => {
    it('should handle Date object', () => {
      const date = new Date('2024-01-15')
      const result = sanitizeDate(date)
      expect(result.value).toMatch(/2024-01-15/)
      expect(result.warning).toBe(false)
    })

    it('should handle invalid Date object', () => {
      const invalidDate = new Date('invalid')
      const result = sanitizeDate(invalidDate)
      expect(result.value).toBe(null)
      expect(result.warning).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle leap year date', () => {
      const result = sanitizeDate('2024-02-29')
      expect(result.value).toMatch(/2024-02-29/)
    })

    it('should handle year boundaries', () => {
      const result = sanitizeDate('2024-12-31')
      expect(result.value).toMatch(/2024-12-31/)
    })

    it('should handle very old dates', () => {
      const result = sanitizeDate('1900-01-01')
      expect(result.value).toMatch(/1900-01-01/)
    })

    it('should handle future dates', () => {
      const result = sanitizeDate('2099-12-31')
      expect(result.value).toMatch(/2099-12-31/)
    })
  })
})

// ============================================================================
// Tests: sanitizeCell
// ============================================================================

describe('sanitizeCell', () => {
  describe('Text Type', () => {
    it('should sanitize text using sanitizeString logic', () => {
      const result = sanitizeCell('  hello  world  ', 'text')
      expect(result.value).toBe('hello world')
      // Text sanitization generates warnings for whitespace normalization
      expect(result.warning).toBe(true)
      expect(result.warningType).toBe('whitespace')
    })

    it('should convert numbers to text', () => {
      const result = sanitizeCell(123, 'text')
      expect(result.value).toBe('123')
    })

    it('should handle null for text', () => {
      const result = sanitizeCell(null, 'text')
      expect(result.value).toBe('')
    })
  })

  describe('Number Type', () => {
    it('should sanitize number using sanitizeNumber logic', () => {
      const result = sanitizeCell('aa123', 'number')
      expect(result.value).toBe(123)
      expect(result.warning).toBe(true)
    })

    it('should handle clean number', () => {
      const result = sanitizeCell('456', 'number')
      expect(result.value).toBe(456)
      expect(result.warning).toBe(false)
    })

    it('should handle null for number', () => {
      const result = sanitizeCell(null, 'number')
      expect(result.value).toBe(null)
      expect(result.warning).toBe(false)
    })
  })

  describe('Currency Type', () => {
    it('should sanitize currency using sanitizeCurrency logic', () => {
      const result = sanitizeCell('$1,234.56', 'currency')
      expect(result.value).toBe(1234.56)
      expect(result.warning).toBe(false)
    })

    it('should handle currency with text', () => {
      const result = sanitizeCell('$99.99 each', 'currency')
      expect(result.value).toBe(99.99)
      expect(result.warning).toBe(true)
    })
  })

  describe('Date Type', () => {
    it('should sanitize date using sanitizeDate logic', () => {
      const result = sanitizeCell('01/15/2024', 'date')
      expect(result.value).toMatch(/2024-01-15/)
      expect(result.warning).toBe(false)
    })

    it('should handle invalid date', () => {
      const result = sanitizeCell('not-a-date', 'date')
      expect(result.value).toBe(null)
      expect(result.warning).toBe(true)
    })
  })

  describe('Select Type', () => {
    it('should pass through valid select value', () => {
      const result = sanitizeCell('Option A', 'select')
      expect(result.value).toBe('Option A')
      expect(result.warning).toBe(false)
    })

    it('should trim select value', () => {
      const result = sanitizeCell('  Option A  ', 'select')
      expect(result.value).toBe('Option A')
    })

    it('should handle null for select', () => {
      const result = sanitizeCell(null, 'select')
      expect(result.value).toBe(null)
      expect(result.warning).toBe(false)
    })
  })
})

// ============================================================================
// Tests: sanitizeRow
// ============================================================================

describe('sanitizeRow', () => {
  describe('Basic Row Sanitization', () => {
    it('should sanitize all columns in a row', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text' }),
        createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
        createColumn({ id: 'price', name: 'Price', type: 'currency' }),
      ]

      const row = {
        name: '  Product A  ',
        qty: '10',
        price: '$19.99',
      }

      const result = sanitizeRow(row, columns)

      expect(result.data.name).toBe('Product A')
      expect(result.data.qty).toBe(10)
      expect(result.data.price).toBe(19.99)
    })

    it('should count warnings correctly', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'qty1', name: 'Qty 1', type: 'number' }),
        createColumn({ id: 'qty2', name: 'Qty 2', type: 'number' }),
        createColumn({ id: 'qty3', name: 'Qty 3', type: 'number' }),
      ]

      const row = {
        qty1: '10',      // Clean - no warning
        qty2: 'aa20',    // Extracted - warning
        qty3: 'bb30cc',  // Extracted - warning
      }

      const result = sanitizeRow(row, columns)

      expect(result.warningCount).toBe(2)
      expect(result.warnings.qty2).toBeDefined()
      expect(result.warnings.qty3).toBeDefined()
      expect(result.warnings.qty1).toBeUndefined()
    })

    it('should return zero warnings for clean data', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text' }),
        createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
      ]

      const row = {
        name: 'Product',
        qty: '100',
      }

      const result = sanitizeRow(row, columns)

      expect(result.warningCount).toBe(0)
      expect(Object.keys(result.warnings).length).toBe(0)
    })
  })

  describe('Missing Columns in Row', () => {
    it('should handle missing column data gracefully', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text' }),
        createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
      ]

      const row = {
        name: 'Product',
        // qty is missing
      }

      const result = sanitizeRow(row, columns)

      expect(result.data.name).toBe('Product')
      expect(result.data.qty).toBe(null)
    })

    it('should not create warning for optional missing data', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text', required: false }),
        createColumn({ id: 'notes', name: 'Notes', type: 'text', required: false }),
      ]

      const row = {
        name: 'Product',
        // notes is missing but optional
      }

      const result = sanitizeRow(row, columns)

      expect(result.warningCount).toBe(0)
    })
  })

  describe('Extra Columns in Row', () => {
    it('should ignore columns not in schema', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text' }),
      ]

      const row = {
        name: 'Product',
        extraField: 'should be ignored',
        anotherExtra: 12345,
      }

      const result = sanitizeRow(row, columns)

      expect(result.data.name).toBe('Product')
      expect(result.data.extraField).toBeUndefined()
      expect(result.data.anotherExtra).toBeUndefined()
    })
  })

  describe('All Column Types', () => {
    it('should handle all column types in one row', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text' }),
        createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
        createColumn({ id: 'price', name: 'Price', type: 'currency' }),
        createColumn({ id: 'date', name: 'Date', type: 'date' }),
        createColumn({ id: 'status', name: 'Status', type: 'select', options: ['Active', 'Inactive'] }),
      ]

      const row = {
        name: '  Widget  ',
        qty: '$100', // Intentionally wrong format
        price: '$49.99',
        date: '2024-01-15',
        status: 'Active',
      }

      const result = sanitizeRow(row, columns)

      expect(result.data.name).toBe('Widget')
      expect(result.data.qty).toBe(100) // Extracted number
      expect(result.data.price).toBe(49.99)
      expect(result.data.date).toMatch(/2024-01-15/)
      expect(result.data.status).toBe('Active')

      // Should have warning for qty (wrong format)
      expect(result.warningCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Warning Messages', () => {
    it('should provide descriptive warning messages', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
      ]

      const row = {
        qty: 'abc123def',
      }

      const result = sanitizeRow(row, columns)

      expect(result.warnings.qty).toBeDefined()
      expect(typeof result.warnings.qty).toBe('object')
      expect(result.warnings.qty.message.length).toBeGreaterThan(0)
      expect(result.warnings.qty.type).toBe('number_extraction')
    })
  })
})

// ============================================================================
// Integration Tests: Full Import Sanitization Flow
// ============================================================================

describe('Import Sanitization Integration', () => {
  describe('Batch Row Processing', () => {
    it('should process multiple rows and aggregate warnings', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Name', type: 'text' }),
        createColumn({ id: 'qty', name: 'Quantity', type: 'number' }),
      ]

      const rows = [
        { name: 'Product A', qty: '10' },     // Clean
        { name: 'Product B', qty: 'aa20' },   // 1 warning
        { name: 'Product C', qty: 'bb30' },   // 1 warning
      ]

      let totalWarnings = 0
      const sanitizedRows = rows.map((row) => {
        const result = sanitizeRow(row, columns)
        totalWarnings += result.warningCount
        return result.data
      })

      expect(sanitizedRows.length).toBe(3)
      expect(totalWarnings).toBe(2)
    })
  })

  describe('Real-World Data Scenarios', () => {
    it('should handle typical Excel export data', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'sku', name: 'SKU', type: 'text' }),
        createColumn({ id: 'name', name: 'Product Name', type: 'text' }),
        createColumn({ id: 'qty', name: 'Stock', type: 'number' }),
        createColumn({ id: 'price', name: 'Price', type: 'currency' }),
        createColumn({ id: 'lastOrder', name: 'Last Order', type: 'date' }),
      ]

      const excelRow = {
        sku: 'SKU-001  ',
        name: '  Widget Pro Max  ',
        qty: '  1,234  ',
        price: '$49.99',
        lastOrder: '1/15/2024',
      }

      const result = sanitizeRow(excelRow, columns)

      expect(result.data.sku).toBe('SKU-001')
      expect(result.data.name).toBe('Widget Pro Max')
      expect(result.data.qty).toBe(1234)
      expect(result.data.price).toBe(49.99)
      expect(result.data.lastOrder).toMatch(/2024-01-15/)
    })

    it('should handle messy CSV data', () => {
      const columns: ColumnDefinition[] = [
        createColumn({ id: 'name', name: 'Item', type: 'text' }),
        createColumn({ id: 'qty', name: 'Count', type: 'number' }),
        createColumn({ id: 'cost', name: 'Unit Cost', type: 'currency' }),
      ]

      const csvRow = {
        name: '"Widget"',  // Quoted
        qty: '50 units',   // Has text suffix
        cost: 'USD 12.50', // Has currency prefix
      }

      const result = sanitizeRow(csvRow, columns)

      // Should extract values even from messy data
      expect(result.data.qty).toBe(50)
      expect(result.data.cost).toBe(12.5)
      expect(result.warningCount).toBeGreaterThan(0) // Warnings for modifications
    })
  })
})
