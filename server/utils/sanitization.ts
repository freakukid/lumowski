import type { ColumnType, ColumnDefinition } from '~/types/schema'
import type { SanitizationWarning } from '~/types/import'

/**
 * Warning types for sanitization operations
 */
export type SanitizationWarningType = SanitizationWarning['type']

/**
 * Result type for sanitization functions that track warnings
 */
export interface SanitizeResult<T> {
  /** The sanitized value, or null if sanitization failed completely */
  value: T | null
  /** Whether the value was modified during sanitization (triggers warning) */
  warning: boolean
  /** Optional message describing what was changed */
  warningMessage?: string
  /** Type of sanitization that was applied when warning is true */
  warningType?: SanitizationWarningType
}

/**
 * Detailed warning for a single column in a row
 */
export interface RowWarning {
  /** Warning message describing what was changed */
  message: string
  /** Type of sanitization that was applied */
  type: SanitizationWarningType
}

/**
 * Result of sanitizing an entire row
 */
export interface SanitizeRowResult {
  /** The sanitized row data */
  data: Record<string, unknown>
  /** Total number of warnings generated */
  warningCount: number
  /** Detailed warnings by column ID */
  warnings: Record<string, RowWarning>
}

/**
 * Currency symbols that are recognized without generating warnings
 */
const CURRENCY_SYMBOLS = ['$', '€', '£', '¥']

/**
 * Regular expression to match properly formatted currency/numeric values.
 * Accepts:
 * - Currency symbol ($, €, £, ¥) with thousands separators: $1,234, $1,234.56
 * - Currency symbol with decimals (cents): $1.50, $49.99
 * - Just thousands separators without currency: 1,234.56, 1,234,567
 * - Accounting format with parentheses: ($1,234.56)
 * Does NOT match currency symbol alone without any formatting (e.g., $100 should warn)
 */
const CURRENCY_REGEX = /^[\s]*(\()?[\s]*[-]?[\s]*[$€£¥][\s]*[-]?[\s]*\d{1,3}(?:,\d{3})+(?:[.,]\d+)?[\s]*[$€£¥]?[\s]*(\))?[\s]*$|^[\s]*(\()?[\s]*[-]?[\s]*[$€£¥][\s]*[-]?[\s]*\d+[.,]\d+[\s]*[$€£¥]?[\s]*(\))?[\s]*$|^[\s]*(\()?[\s]*[-]?[\s]*\d{1,3}(?:,\d{3})+(?:[.,]\d+)?[\s]*[$€£¥]?[\s]*(\))?[\s]*$/

/**
 * Sanitizes a string value by normalizing whitespace and converting types.
 *
 * - Converts null/undefined to empty string
 * - Converts numbers/booleans to string
 * - Trims leading/trailing whitespace
 * - Normalizes multiple spaces/tabs/newlines to single space
 * - Preserves special characters and unicode
 */
export function sanitizeString(value: unknown): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return ''
  }

  // Convert non-string types to string
  let str: string
  if (typeof value === 'string') {
    str = value
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    str = String(value)
  } else {
    str = String(value)
  }

  // Normalize all whitespace (spaces, tabs, newlines, carriage returns) to single spaces
  // Then trim leading/trailing whitespace
  return str
    .replace(/[\s]+/g, ' ')
    .trim()
}

/**
 * Checks if a string represents a clean currency-formatted number
 * (with optional currency symbol and thousands separators)
 */
function isCurrencyFormat(str: string): boolean {
  return CURRENCY_REGEX.test(str)
}

/**
 * Parses a currency-formatted string into a number.
 * Handles both US format (1,234.56) and European format (1.234,56).
 */
function parseCurrencyFormat(str: string): number | null {
  // Check for accounting negative format (parentheses)
  const isAccountingNegative = str.includes('(') && str.includes(')')

  // Check for explicit negative sign
  const hasNegativeSign = str.includes('-')

  // Remove currency symbols, parentheses, and whitespace
  let cleaned = str.replace(/[$€£¥()\s-]/g, '')

  // Detect format: if we have both comma and period, determine which is decimal separator
  const lastComma = cleaned.lastIndexOf(',')
  const lastPeriod = cleaned.lastIndexOf('.')

  if (lastComma > -1 && lastPeriod > -1) {
    // Both exist - the one that appears last is the decimal separator
    if (lastComma > lastPeriod) {
      // European format: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // US format: 1,234.56
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (lastComma > -1) {
    // Only comma exists - check if it's a thousands separator or decimal
    const afterComma = cleaned.substring(lastComma + 1)
    if (afterComma.length === 3 && !afterComma.includes(',')) {
      // Likely a thousands separator (e.g., "1,234")
      cleaned = cleaned.replace(/,/g, '')
    } else {
      // Likely a decimal separator (e.g., "1,5" or "1,23")
      cleaned = cleaned.replace(',', '.')
    }
  } else if (lastPeriod > -1) {
    // Only period exists - keep as is (standard decimal)
    cleaned = cleaned.replace(/,/g, '')
  }

  const num = parseFloat(cleaned)
  if (isNaN(num)) {
    return null
  }

  // Apply negative if accounting format or has negative sign
  return (isAccountingNegative || hasNegativeSign) ? -Math.abs(num) : num
}

/**
 * Extracts the first complete number from a string.
 * Returns both the number and whether extraction was needed (warning).
 */
function extractNumber(str: string): { value: number | null; warning: boolean } {
  // Handle scientific notation directly
  const scientificMatch = str.match(/[-+]?\d*\.?\d+[eE][-+]?\d+/)
  if (scientificMatch) {
    const num = parseFloat(scientificMatch[0])
    if (!isNaN(num) && isFinite(num)) {
      // Check if the original string is just the scientific notation (clean)
      const trimmed = str.trim()
      if (trimmed === scientificMatch[0]) {
        return { value: num, warning: false }
      }
      return { value: num, warning: true }
    }
  }

  // Try to extract a currency-formatted number first (handles "$1,234.56 USD" cases)
  // This matches patterns like: $1,234.56, €1.234,56, 1,234.56, etc.
  const currencyMatch = str.match(/[$€£¥]?\s*-?\s*[\d,]+(?:[.,]\d+)?/)
  if (currencyMatch) {
    const matchedStr = currencyMatch[0]
    // Check if this looks like a formatted number (has comma or currency symbol)
    if (matchedStr.includes(',') || /[$€£¥]/.test(matchedStr)) {
      const parsed = parseCurrencyFormat(matchedStr)
      if (parsed !== null) {
        return { value: parsed, warning: true }
      }
    }
  }

  // Try to find a negative number pattern (handles "value: -42" cases)
  const negativeMatch = str.match(/-\s*\d+(?:\.\d+)?/)
  if (negativeMatch) {
    const numStr = negativeMatch[0].replace(/\s/g, '')
    const num = parseFloat(numStr)
    if (!isNaN(num) && isFinite(num)) {
      return { value: num, warning: true }
    }
  }

  // Find the first complete number (integer or decimal)
  // This regex matches numbers like: 123, 3.14, .5, 0.5
  const match = str.match(/\d+(?:\.\d+)?|\.\d+/)
  if (match) {
    const num = parseFloat(match[0])
    if (!isNaN(num) && isFinite(num)) {
      return { value: num, warning: true }
    }
  }

  return { value: null, warning: true }
}

/**
 * Sanitizes a value to a number.
 *
 * - Returns { value: null, warning: false } for empty/null/undefined
 * - Returns { value: number, warning: false } for clean numbers
 * - Extracts numbers from mixed alphanumeric with warning: true
 * - Handles currency formatting without warning
 * - Returns { value: null, warning: true } if no numbers found
 */
export function sanitizeNumber(value: unknown): SanitizeResult<number> {
  // Handle null/undefined - no warning
  if (value === null || value === undefined) {
    return { value: null, warning: false }
  }

  // Handle NaN and Infinity
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      return { value: null, warning: true, warningType: 'number_extraction' }
    }
    return { value: value, warning: false }
  }

  // Convert to string for processing
  const str = String(value).trim()

  // Handle empty or whitespace-only string - no warning
  if (str === '') {
    return { value: null, warning: false }
  }

  // Check if it's a clean number (possibly with leading/trailing whitespace)
  const cleanNumber = parseFloat(str)
  if (!isNaN(cleanNumber) && isFinite(cleanNumber) && str === String(cleanNumber)) {
    return { value: cleanNumber, warning: false }
  }

  // Check if it's a simple numeric string (handles "123", "-45.67", ".5", "00123")
  const simpleNumericRegex = /^[-+]?\d*\.?\d+$/
  if (simpleNumericRegex.test(str)) {
    const num = parseFloat(str)
    if (!isNaN(num) && isFinite(num)) {
      return { value: num, warning: false }
    }
  }

  // Check if it's currency-formatted (no warning for common formats)
  if (isCurrencyFormat(str)) {
    const num = parseCurrencyFormat(str)
    if (num !== null) {
      return { value: num, warning: false }
    }
  }

  // Try to extract a number from mixed content (will generate warning)
  const extracted = extractNumber(str)
  if (extracted.value !== null) {
    return {
      value: extracted.value,
      warning: true,
      warningType: 'number_extraction',
    }
  }

  // No number found
  return {
    value: null,
    warning: true,
    warningType: 'number_extraction',
  }
}

/**
 * Sanitizes a value to a currency amount.
 *
 * Similar to sanitizeNumber but specifically handles:
 * - Accounting format: "(123.45)" -> -123.45
 * - Currency symbols: $, €, £, ¥
 */
export function sanitizeCurrency(value: unknown): SanitizeResult<number> {
  // Delegate to sanitizeNumber which already handles currency formats
  const result = sanitizeNumber(value)
  // Change warning type to currency_parsing for currency columns
  if (result.warningType === 'number_extraction') {
    result.warningType = 'currency_parsing'
  }
  return result
}

/**
 * Month name mappings for date parsing
 */
const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
}

/**
 * Attempts to parse a date string in various formats.
 * Returns an ISO date string on success, null on failure.
 */
function parseDate(str: string): string | null {
  const trimmed = str.trim()

  // Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10)
    const day = parseInt(isoMatch[3], 10)
    if (isValidDate(year, month, day)) {
      const date = new Date(trimmed)
      if (!isNaN(date.getTime())) {
        return date.toISOString()
      }
      // If full string doesn't parse, try just the date part
      const dateOnly = new Date(year, month - 1, day)
      if (!isNaN(dateOnly.getTime())) {
        return dateOnly.toISOString()
      }
    }
    return null
  }

  // Try YYYY/MM/DD format
  const slashIsoMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (slashIsoMatch) {
    const year = parseInt(slashIsoMatch[1], 10)
    const month = parseInt(slashIsoMatch[2], 10)
    const day = parseInt(slashIsoMatch[3], 10)
    if (isValidDate(year, month, day)) {
      const date = new Date(year, month - 1, day)
      return date.toISOString()
    }
    return null
  }

  // Try "Month DD, YYYY" or "Mon DD, YYYY" format (with optional time)
  const longDateMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?/i)
  if (longDateMatch) {
    const monthName = longDateMatch[1].toLowerCase()
    const month = MONTH_NAMES[monthName]
    if (month !== undefined) {
      const day = parseInt(longDateMatch[2], 10)
      const year = parseInt(longDateMatch[3], 10)
      if (isValidDate(year, month + 1, day)) {
        let hours = longDateMatch[4] ? parseInt(longDateMatch[4], 10) : 0
        const minutes = longDateMatch[5] ? parseInt(longDateMatch[5], 10) : 0
        const ampm = longDateMatch[6]?.toUpperCase()

        if (ampm === 'PM' && hours < 12) hours += 12
        if (ampm === 'AM' && hours === 12) hours = 0

        const date = new Date(year, month, day, hours, minutes)
        return date.toISOString()
      }
    }
    return null
  }

  // Try MM/DD/YYYY or DD/MM/YYYY format
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (slashMatch) {
    const first = parseInt(slashMatch[1], 10)
    const second = parseInt(slashMatch[2], 10)
    const year = parseInt(slashMatch[3], 10)

    // If first number > 12, it must be day (DD/MM/YYYY)
    if (first > 12) {
      if (isValidDate(year, second, first)) {
        const date = new Date(year, second - 1, first)
        return date.toISOString()
      }
    } else {
      // Assume MM/DD/YYYY (US format) as default
      if (isValidDate(year, first, second)) {
        const date = new Date(year, first - 1, second)
        return date.toISOString()
      }
    }
    return null
  }

  // Try "YYYY-MM-DD HH:mm:ss" format (with space instead of T)
  const dateTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):?(\d{2})?/)
  if (dateTimeMatch) {
    const year = parseInt(dateTimeMatch[1], 10)
    const month = parseInt(dateTimeMatch[2], 10)
    const day = parseInt(dateTimeMatch[3], 10)
    const hours = parseInt(dateTimeMatch[4], 10)
    const minutes = parseInt(dateTimeMatch[5], 10)
    const seconds = dateTimeMatch[6] ? parseInt(dateTimeMatch[6], 10) : 0

    if (isValidDate(year, month, day)) {
      const date = new Date(year, month - 1, day, hours, minutes, seconds)
      if (!isNaN(date.getTime())) {
        return date.toISOString()
      }
    }
    return null
  }

  // Try native Date parsing as last resort (but be careful with ambiguous formats)
  const nativeDate = new Date(trimmed)
  if (!isNaN(nativeDate.getTime())) {
    // Validate that it's a reasonable date (not just any parsed number)
    const year = nativeDate.getFullYear()
    if (year >= 1000 && year <= 9999) {
      return nativeDate.toISOString()
    }
  }

  return null
}

/**
 * Validates if a date is valid (checks month/day ranges)
 */
function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  // Check days per month
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  // Leap year check
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
    if (isLeap) {
      if (day > 29) return false
    } else {
      if (day > 28) return false
    }
  } else {
    if (day > daysInMonth[month - 1]) return false
  }

  return true
}

/**
 * Sanitizes a value to a date (ISO string format).
 *
 * - Parses various formats: ISO, MM/DD/YYYY, DD/MM/YYYY, "January 15, 2024"
 * - Returns ISO string on success
 * - Returns { value: null, warning: true } for invalid dates
 * - Returns { value: null, warning: false } for empty input
 */
export function sanitizeDate(value: unknown): SanitizeResult<string> {
  // Handle null/undefined - no warning
  if (value === null || value === undefined) {
    return { value: null, warning: false }
  }

  // Handle Date objects
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      return { value: null, warning: true, warningType: 'date_parsing' }
    }
    return { value: value.toISOString(), warning: false }
  }

  // Convert to string
  const str = String(value).trim()

  // Handle empty or whitespace-only string - no warning
  if (str === '') {
    return { value: null, warning: false }
  }

  // Try to parse the date
  const parsed = parseDate(str)
  if (parsed) {
    return { value: parsed, warning: false }
  }

  // Invalid date
  return {
    value: null,
    warning: true,
    warningType: 'date_parsing',
  }
}

/**
 * Sanitizes a cell value based on its column type.
 *
 * - type='text' -> sanitizeString wrapped in result
 * - type='number' -> sanitizeNumber
 * - type='currency' -> sanitizeCurrency
 * - type='date' -> sanitizeDate
 * - type='select' -> sanitizeString wrapped in result (with null handling)
 */
export function sanitizeCell(value: unknown, type: ColumnType): SanitizeResult<unknown> {
  switch (type) {
    case 'text': {
      const original = value === null || value === undefined ? '' : String(value)
      const sanitized = sanitizeString(value)
      // Check if whitespace was normalized
      const hadExcessWhitespace = original !== sanitized && original.trim() !== sanitized
      return {
        value: sanitized,
        warning: hadExcessWhitespace,
        warningType: hadExcessWhitespace ? 'whitespace' : undefined,
      }
    }

    case 'number':
      return sanitizeNumber(value)

    case 'currency':
      return sanitizeCurrency(value)

    case 'date':
      return sanitizeDate(value)

    case 'select': {
      // For select, handle null/undefined specially
      if (value === null || value === undefined) {
        return { value: null, warning: false }
      }
      const str = String(value).trim()
      if (str === '') {
        return { value: null, warning: false }
      }
      // Normalize whitespace but preserve the value
      const original = String(value)
      const sanitized = sanitizeString(value)
      const hadExcessWhitespace = original !== sanitized && original.trim() !== sanitized
      return {
        value: sanitized,
        warning: hadExcessWhitespace,
        warningType: hadExcessWhitespace ? 'whitespace' : undefined,
      }
    }

    default:
      // Unknown type - treat as text
      return { value: sanitizeString(value), warning: false }
  }
}

/**
 * Sanitizes an entire row of data according to column definitions.
 *
 * - Sanitizes each value according to its column type
 * - Aggregates warning count
 * - Returns { data, warningCount, warnings }
 */
export function sanitizeRow(
  row: Record<string, unknown>,
  columns: ColumnDefinition[]
): SanitizeRowResult {
  const data: Record<string, unknown> = {}
  const warnings: Record<string, RowWarning> = {}
  let warningCount = 0

  for (const column of columns) {
    const rawValue = row[column.id]
    const result = sanitizeCell(rawValue, column.type)

    data[column.id] = result.value

    if (result.warning) {
      warningCount++
      warnings[column.id] = {
        message: result.warningMessage ||
          `Value was modified during sanitization for column "${column.name}"`,
        type: result.warningType || 'other',
      }
    }
  }

  return { data, warningCount, warnings }
}

/**
 * Format a sanitization warning type for display
 */
export function formatWarningType(type: SanitizationWarningType): string {
  switch (type) {
    case 'whitespace':
      return 'Whitespace normalized'
    case 'number_extraction':
      return 'Number extracted'
    case 'currency_parsing':
      return 'Currency parsed'
    case 'date_parsing':
      return 'Date parsed'
    default:
      return 'Value modified'
  }
}
