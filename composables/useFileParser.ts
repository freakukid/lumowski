import * as XLSX from 'xlsx'
import type { ParsedFile, ImportFileType } from '~/types/import'

/**
 * Common header words that indicate a row is likely a header
 */
const HEADER_KEYWORDS = [
  'name', 'id', 'sku', 'qty', 'quantity', 'price', 'date', 'description',
  'desc', 'item', 'product', 'category', 'type', 'status', 'stock',
  'cost', 'unit', 'notes', 'barcode', 'upc', 'ean', 'asin', 'title',
  'brand', 'supplier', 'vendor', 'location', 'bin', 'shelf', 'warehouse',
  'min', 'max', 'reorder', 'weight', 'size', 'color', 'model', 'serial',
]

/**
 * Composable for parsing import files (Excel, CSV, JSON)
 */
export const useFileParser = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Maximum file size allowed for import (50MB)
   */
  const MAX_FILE_SIZE = 50 * 1024 * 1024

  /**
   * Detect file type from file extension
   */
  const detectFileType = (fileName: string): ImportFileType | null => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'xlsx':
        return 'xlsx'
      case 'xls':
        return 'xls'
      case 'csv':
        return 'csv'
      case 'json':
        return 'json'
      default:
        return null
    }
  }

  /**
   * Parse a file and return structured data
   */
  const parseFile = async (file: File): Promise<ParsedFile | null> => {
    isLoading.value = true
    error.value = null

    try {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        error.value = `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit. Please use a smaller file.`
        return null
      }

      const fileType = detectFileType(file.name)
      if (!fileType) {
        error.value = 'Unsupported file type. Please use .xlsx, .xls, .csv, or .json files.'
        return null
      }

      let data: unknown[][]

      if (fileType === 'json') {
        data = await parseJsonFile(file)
      } else {
        data = await parseSpreadsheetFile(file)
      }

      if (data.length === 0) {
        error.value = 'The file appears to be empty.'
        return null
      }

      const suggestedHeaderRow = detectHeaderRow(data)

      return {
        data,
        suggestedHeaderRow,
        fileType,
        fileName: file.name,
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to parse file'
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Parse JSON file into 2D array format
   */
  const parseJsonFile = async (file: File): Promise<unknown[][]> => {
    try {
      const text = await file.text()
      const json = JSON.parse(text)

    // Handle array of objects (most common case)
    if (Array.isArray(json) && json.length > 0 && typeof json[0] === 'object') {
      // Extract all unique keys for headers
      const allKeys = new Set<string>()
      json.forEach((item) => {
        if (item && typeof item === 'object') {
          Object.keys(item).forEach((key) => allKeys.add(key))
        }
      })
      const headers = Array.from(allKeys)

      // Create header row and data rows
      const data: unknown[][] = [headers]
      json.forEach((item) => {
        if (item && typeof item === 'object') {
          const row = headers.map((header) => (item as Record<string, unknown>)[header] ?? '')
          data.push(row)
        }
      })

      return data
    }

    // Handle array of arrays
    if (Array.isArray(json) && json.length > 0 && Array.isArray(json[0])) {
      return json
    }

      throw new Error('Invalid JSON format. Expected an array of objects or array of arrays.')
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error('Invalid JSON file: ' + err.message)
      }
      throw err
    }
  }

  /**
   * Parse Excel/CSV file using xlsx library
   */
  const parseSpreadsheetFile = async (file: File): Promise<unknown[][]> => {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellDates: true  // Parse dates as JS Date objects
    })

    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('No sheets found in the file.')
    }

    const worksheet = workbook.Sheets[firstSheetName]
    if (!worksheet) {
      throw new Error('Failed to read worksheet.')
    }

    // Convert to 2D array with header detection disabled (we'll handle headers ourselves)
    const data = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,       // Return formatted strings instead of raw numbers
      dateNF: 'yyyy-mm-dd'  // Format for date cells
    })

    return data as unknown[][]
  }

  /**
   * Score a row to determine if it's likely a header row
   * Returns a score where higher = more likely to be a header
   */
  const scoreRow = (row: unknown[], nextRow: unknown[] | undefined): number => {
    let score = 0

    // Count non-empty cells
    const nonEmptyCells = row.filter((cell) => cell !== null && cell !== undefined && cell !== '')

    // Penalize mostly empty rows heavily
    if (nonEmptyCells.length < row.length * 0.3) {
      score -= 10
    }

    for (const cell of row) {
      // Skip empty cells
      if (cell === null || cell === undefined || cell === '') {
        continue
      }

      const cellStr = String(cell).toLowerCase().trim()

      // +2 for each non-empty string cell
      if (typeof cell === 'string' && cellStr.length > 0) {
        score += 2
      }

      // +5 for common header keywords
      for (const keyword of HEADER_KEYWORDS) {
        if (cellStr.includes(keyword)) {
          score += 5
          break // Only count once per cell
        }
      }
    }

    // +3 if the next row has different types (text header -> numeric data)
    if (nextRow) {
      let typeDifferences = 0
      const minLength = Math.min(row.length, nextRow.length)

      for (let i = 0; i < minLength; i++) {
        const currentCell = row[i]
        const nextCell = nextRow[i]

        const currentIsString = typeof currentCell === 'string' && isNaN(Number(currentCell))
        const nextIsNumber = typeof nextCell === 'number' || !isNaN(Number(nextCell))

        if (currentIsString && nextIsNumber && nextCell !== '' && nextCell !== null) {
          typeDifferences++
        }
      }

      if (typeDifferences >= 2) {
        score += 3
      }
    }

    return score
  }

  /**
   * Detect the most likely header row in the data
   * Returns the index of the header row (0-based)
   */
  const detectHeaderRow = (data: unknown[][]): number => {
    if (data.length === 0) return 0
    if (data.length === 1) return 0

    // Only check the first 10 rows
    const maxRowsToCheck = Math.min(10, data.length)
    let bestRowIndex = 0
    let bestScore = -Infinity

    for (let i = 0; i < maxRowsToCheck; i++) {
      const row = data[i]
      const nextRow = i + 1 < data.length ? data[i + 1] : undefined
      const score = scoreRow(row, nextRow)

      if (score > bestScore) {
        bestScore = score
        bestRowIndex = i
      }
    }

    return bestRowIndex
  }

  /**
   * Get column headers from data at the specified row index
   */
  const getHeaders = (data: unknown[][], headerRowIndex: number): string[] => {
    if (headerRowIndex < 0 || headerRowIndex >= data.length) {
      return []
    }

    const headerRow = data[headerRowIndex]
    return headerRow.map((cell, index) => {
      if (cell === null || cell === undefined || cell === '') {
        return `Column ${index + 1}`
      }
      return String(cell).trim()
    })
  }

  /**
   * Get data rows (excluding header row)
   */
  const getDataRows = (data: unknown[][], headerRowIndex: number): unknown[][] => {
    return data.filter((_, index) => index > headerRowIndex)
  }

  return {
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    parseFile,
    detectFileType,
    detectHeaderRow,
    getHeaders,
    getDataRows,
  }
}
