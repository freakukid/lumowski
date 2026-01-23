import type { ColumnDefinition } from '~/types/schema'
import type { ColumnMatch, ColumnMapping } from '~/types/import'

/**
 * Alias mappings for common column name variations
 * Maps alternative names to standard names
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  quantity: ['qty', 'qnty', 'amount', 'count', 'stock', 'units'],
  description: ['desc', 'details', 'info', 'about'],
  price: ['value', 'rate', 'unit_price', 'unitprice'],
  cost: ['unit_cost', 'unitcost', 'purchase_price', 'purchaseprice', 'wholesale'],
  name: ['title', 'item', 'product', 'productname', 'item_name', 'itemname'],
  sku: ['id', 'code', 'product_id', 'productid', 'item_id', 'itemid', 'barcode', 'upc', 'ean'],
  date: ['created', 'updated', 'timestamp', 'time', 'datetime', 'created_at', 'updated_at'],
  category: ['type', 'group', 'class', 'classification'],
  status: ['state', 'condition', 'availability'],
  notes: ['note', 'comment', 'comments', 'remarks', 'memo'],
  location: ['loc', 'bin', 'shelf', 'warehouse', 'storage'],
  supplier: ['vendor', 'provider', 'source'],
  minimum: ['min', 'minquantity', 'min_quantity', 'reorder', 'reorderlevel', 'reorder_level'],
}

/**
 * Composable for matching file columns to schema columns
 */
export const useColumnMatcher = () => {
  /**
   * Calculate Levenshtein distance between two strings
   * Used for fuzzy matching
   */
  const levenshteinDistance = (str1: string, str2: string): number => {
    const m = str1.length
    const n = str2.length

    // Create a 2D array to store distances
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0))

    // Initialize base cases
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    // Fill in the rest of the matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
        }
      }
    }

    return dp[m][n]
  }

  /**
   * Calculate similarity between two strings (0-1)
   * 1 = identical, 0 = completely different
   */
  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1
    if (str1.length === 0 || str2.length === 0) return 0

    const distance = levenshteinDistance(str1, str2)
    const maxLength = Math.max(str1.length, str2.length)

    return 1 - distance / maxLength
  }

  /**
   * Normalize a column name for comparison
   * Removes special characters, converts to lowercase, trims whitespace
   */
  const normalizeColumnName = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '')
  }

  /**
   * Check if a file column name matches a schema column via aliases
   */
  const checkAliasMatch = (
    fileColumnName: string,
    schemaColumnName: string
  ): boolean => {
    const normalizedFile = normalizeColumnName(fileColumnName)
    const normalizedSchema = normalizeColumnName(schemaColumnName)

    // Check if schema column name is an alias key
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      const normalizedKey = normalizeColumnName(key)

      // If schema column matches a key or its aliases
      if (normalizedSchema === normalizedKey || aliases.includes(normalizedSchema)) {
        // Check if file column matches the key or any alias
        if (normalizedFile === normalizedKey || aliases.includes(normalizedFile)) {
          return true
        }
      }
    }

    // Also check reverse: file column might be the key, schema column might be an alias
    for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
      const normalizedKey = normalizeColumnName(key)

      if (normalizedFile === normalizedKey || aliases.includes(normalizedFile)) {
        if (normalizedSchema === normalizedKey || aliases.includes(normalizedSchema)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Find the best match for a file column name among schema columns
   */
  const findBestMatch = (
    fileColumnName: string,
    schemaColumns: ColumnDefinition[]
  ): ColumnMatch | null => {
    const normalizedFileName = normalizeColumnName(fileColumnName)

    // 1. Try exact match first
    for (const schemaColumn of schemaColumns) {
      const normalizedSchemaName = normalizeColumnName(schemaColumn.name)
      if (normalizedFileName === normalizedSchemaName) {
        return {
          schemaColumn,
          confidence: 1.0,
          matchType: 'exact',
        }
      }
    }

    // 2. Try alias match
    for (const schemaColumn of schemaColumns) {
      if (checkAliasMatch(fileColumnName, schemaColumn.name)) {
        return {
          schemaColumn,
          confidence: 0.9,
          matchType: 'alias',
        }
      }
    }

    // 3. Try fuzzy match with Levenshtein similarity > 0.6
    let bestFuzzyMatch: ColumnMatch | null = null
    let bestSimilarity = 0.6 // Minimum threshold

    for (const schemaColumn of schemaColumns) {
      const normalizedSchemaName = normalizeColumnName(schemaColumn.name)
      const similarity = calculateSimilarity(normalizedFileName, normalizedSchemaName)

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestFuzzyMatch = {
          schemaColumn,
          confidence: similarity,
          matchType: 'fuzzy',
        }
      }
    }

    return bestFuzzyMatch
  }

  /**
   * Auto-match all file columns to schema columns
   * Returns an array of column mappings
   */
  const autoMatchColumns = (
    fileHeaders: string[],
    schemaColumns: ColumnDefinition[]
  ): ColumnMapping[] => {
    const mappings: ColumnMapping[] = []
    const usedSchemaColumns = new Set<string>()

    for (let i = 0; i < fileHeaders.length; i++) {
      const fileColumnName = fileHeaders[i]
      const match = findBestMatch(
        fileColumnName,
        schemaColumns.filter((col) => !usedSchemaColumns.has(col.id))
      )

      if (match) {
        usedSchemaColumns.add(match.schemaColumn.id)
        mappings.push({
          fileColumnIndex: i,
          fileColumnName,
          schemaColumnId: match.schemaColumn.id,
          newColumn: null,
          skip: false,
          confidence: match.confidence,
          matchType: match.matchType,
        })
      } else {
        // No match found - mark for skipping by default
        mappings.push({
          fileColumnIndex: i,
          fileColumnName,
          schemaColumnId: null,
          newColumn: null,
          skip: true,
          confidence: null,
          matchType: 'none',
        })
      }
    }

    return mappings
  }

  /**
   * Get all possible matches for a file column (for dropdown display)
   * Sorted by confidence (best matches first)
   */
  const getAllMatches = (
    fileColumnName: string,
    schemaColumns: ColumnDefinition[]
  ): ColumnMatch[] => {
    const matches: ColumnMatch[] = []
    const normalizedFileName = normalizeColumnName(fileColumnName)

    for (const schemaColumn of schemaColumns) {
      const normalizedSchemaName = normalizeColumnName(schemaColumn.name)

      // Exact match
      if (normalizedFileName === normalizedSchemaName) {
        matches.push({
          schemaColumn,
          confidence: 1.0,
          matchType: 'exact',
        })
        continue
      }

      // Alias match
      if (checkAliasMatch(fileColumnName, schemaColumn.name)) {
        matches.push({
          schemaColumn,
          confidence: 0.9,
          matchType: 'alias',
        })
        continue
      }

      // Fuzzy match
      const similarity = calculateSimilarity(normalizedFileName, normalizedSchemaName)
      if (similarity > 0.3) {
        // Lower threshold for showing in dropdown
        matches.push({
          schemaColumn,
          confidence: similarity,
          matchType: 'fuzzy',
        })
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Check if all required schema columns are mapped
   */
  const validateMappings = (
    mappings: ColumnMapping[],
    schemaColumns: ColumnDefinition[]
  ): { valid: boolean; missingColumns: ColumnDefinition[] } => {
    const requiredColumns = schemaColumns.filter((col) => col.required)
    const mappedColumnIds = new Set(
      mappings
        .filter((m) => !m.skip && m.schemaColumnId)
        .map((m) => m.schemaColumnId)
    )

    const missingColumns = requiredColumns.filter(
      (col) => !mappedColumnIds.has(col.id)
    )

    return {
      valid: missingColumns.length === 0,
      missingColumns,
    }
  }

  return {
    findBestMatch,
    autoMatchColumns,
    getAllMatches,
    validateMappings,
    calculateSimilarity,
    normalizeColumnName,
  }
}
