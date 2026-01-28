/**
 * Composable for date formatting utilities.
 *
 * Provides consistent date formatting across the application.
 */
export function useDate() {
  /**
   * Formats a date string for display (date only, long format).
   *
   * @param dateString - ISO date string to format
   * @returns Formatted date string (e.g., "Monday, January 27, 2026")
   *
   * @example
   * ```typescript
   * formatDate('2026-01-27T10:30:00Z')
   * // Returns: "Monday, January 27, 2026"
   * ```
   */
  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  /**
   * Formats a date string for display with time.
   *
   * @param dateString - ISO date string to format
   * @returns Formatted date/time string (e.g., "Jan 27, 2026, 10:30 AM")
   *
   * @example
   * ```typescript
   * formatDateTime('2026-01-27T10:30:00Z')
   * // Returns: "Jan 27, 2026, 10:30 AM"
   * ```
   */
  function formatDateTime(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /**
   * Formats a date string in short format (date only).
   *
   * @param dateString - ISO date string to format
   * @returns Formatted date string (e.g., "Jan 27, 2026")
   *
   * @example
   * ```typescript
   * formatDateShort('2026-01-27T10:30:00Z')
   * // Returns: "Jan 27, 2026"
   * ```
   */
  function formatDateShort(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return {
    formatDate,
    formatDateTime,
    formatDateShort,
  }
}
