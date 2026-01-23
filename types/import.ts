import type { ColumnDefinition, ColumnRole, ColumnType } from './schema'

/**
 * Represents a sanitization warning for a cell value that was modified
 */
export interface SanitizationWarning {
  /** The column ID where the warning occurred */
  columnId: string
  /** Display name of the column */
  columnName: string
  /** The original value before sanitization */
  originalValue: string
  /** The sanitized value that will be imported */
  sanitizedValue: string
  /** Type of sanitization that was applied */
  type: 'whitespace' | 'number_extraction' | 'currency_parsing' | 'date_parsing' | 'other'
}

/**
 * Supported file types for import
 */
export type ImportFileType = 'xlsx' | 'xls' | 'csv' | 'json'

/**
 * Result of parsing a file - contains the raw data and metadata
 */
export interface ParsedFile {
  /** Raw data as 2D array (rows and columns) */
  data: unknown[][]
  /** Suggested header row index based on detection algorithm */
  suggestedHeaderRow: number
  /** Detected file type */
  fileType: ImportFileType
  /** Original file name */
  fileName: string
}

/**
 * Defines how a file column maps to schema or new column
 */
export interface ColumnMapping {
  /** Index of the column in the file (0-based) */
  fileColumnIndex: number
  /** Header name from the file */
  fileColumnName: string
  /** ID of existing schema column to map to, or null if creating new or skipping */
  schemaColumnId: string | null
  /** If creating a new column, defines the new column */
  newColumn: NewColumnDefinition | null
  /** Whether to skip this column during import */
  skip: boolean
  /** Confidence score of the match (0-1), only for auto-matched columns */
  confidence: number | null
  /** Match type that produced this mapping */
  matchType: 'exact' | 'alias' | 'fuzzy' | 'manual' | 'none'
}

/**
 * Definition for a new column to be created during import
 */
export interface NewColumnDefinition {
  /** Display name for the column */
  name: string
  /** Column data type */
  type: ColumnType
  /** Optional semantic role for the column (e.g., 'name', 'quantity') */
  role?: ColumnRole
  /** For select type, the available options */
  options?: string[]
  /** Whether this field is required */
  required?: boolean
}

/**
 * Result of the import operation
 */
export interface ImportResult {
  /** Number of successfully imported items */
  success: number
  /** Number of items that failed validation */
  failed: number
  /** Error messages for failed items */
  errors: string[]
  /** Total items processed */
  total: number
  /** Number of values that were sanitized/modified during import */
  warningCount?: number
}

/**
 * Validation status for a single row
 */
export interface ValidationStatus {
  /** Row index in the data (0-based, excluding header) */
  rowIndex: number
  /** Whether the row passed validation */
  isValid: boolean
  /** Validation error messages if any */
  errors: string[]
  /** The transformed data ready for import */
  transformedData: Record<string, unknown> | null
  /** Sanitization warnings for values that were modified during processing */
  warnings: SanitizationWarning[]
}

/**
 * A matched column with confidence score
 */
export interface ColumnMatch {
  /** The schema column that was matched */
  schemaColumn: ColumnDefinition
  /** Confidence score (0-1) */
  confidence: number
  /** How the match was determined */
  matchType: 'exact' | 'alias' | 'fuzzy'
}

/**
 * Export format options
 */
export type ExportFormat = 'xlsx' | 'csv' | 'json'

/**
 * Options for export operation
 */
export interface ExportOptions {
  /** Format to export to */
  format: ExportFormat
  /** Column IDs to include in export */
  columnIds: string[]
  /** Custom filename (without extension) */
  filename?: string
  /** Whether to export all items or just current page */
  exportAll: boolean
}

/**
 * Item to be imported (after mapping transformation)
 */
export interface ImportItem {
  /** Mapped data with schema column IDs as keys */
  data: Record<string, unknown>
}

/**
 * Request body for the import execute endpoint
 */
export interface ImportExecuteRequest {
  /** Array of items to import (already transformed with column IDs) */
  items: ImportItem[]
  /** New columns to create before importing */
  newColumns?: NewColumnDefinition[]
}
