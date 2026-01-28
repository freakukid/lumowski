import { z } from 'zod'

// =============================================================================
// String Length Constants
// =============================================================================

/**
 * Maximum string lengths for various field types.
 * These limits prevent database bloat and potential DoS attacks.
 */
export const STRING_LIMITS = {
  /** Reference/order numbers (e.g., PO-12345, INV-2024-001) */
  reference: 500,
  /** Supplier/vendor names */
  supplier: 255,
  /** Customer names */
  customer: 255,
  /** Notes/comments fields */
  notes: 2000,
  /** Generic text inputs */
  text: 1000,
  /** Column names in schema */
  columnName: 100,
  /** Business names */
  businessName: 100,
  /** User names */
  userName: 100,
  /** Check numbers for payment */
  checkNumber: 50,
} as const

// =============================================================================
// Reusable String Validation Schemas
// =============================================================================

/**
 * Optional string field that normalizes empty strings to null.
 * Used for fields like reference, supplier, customer, notes.
 */
export const optionalStringSchema = (maxLength: number, fieldName: string) =>
  z.string()
    .max(maxLength, `${fieldName} must be at most ${maxLength} characters`)
    .optional()
    .nullable()
    .transform((val) => val?.trim() || null)

/** Reference field schema (max 500 chars) */
export const referenceSchema = optionalStringSchema(STRING_LIMITS.reference, 'Reference')

/** Supplier field schema (max 255 chars) */
export const supplierSchema = optionalStringSchema(STRING_LIMITS.supplier, 'Supplier')

/** Customer field schema (max 255 chars) */
export const customerSchema = optionalStringSchema(STRING_LIMITS.customer, 'Customer')

/** Notes field schema (max 2000 chars) */
export const notesSchema = optionalStringSchema(STRING_LIMITS.notes, 'Notes')

/** Check number schema (max 50 chars) */
export const checkNumberSchema = optionalStringSchema(STRING_LIMITS.checkNumber, 'Check number')

// =============================================================================
// Date Validation
// =============================================================================

/**
 * Parses and validates a date string, throwing a 400 error if invalid.
 * Returns a Date object on success.
 *
 * @param dateString - The date string to parse
 * @param errorMessage - Custom error message (default: 'Invalid date format')
 * @returns A valid Date object
 * @throws H3Error with 400 status code if date is invalid
 *
 * @example
 * const operationDate = validateDate(body.date)
 *
 * @example
 * const startDate = validateDate(query.startDate, 'Invalid start date')
 */
export function validateDate(
  dateString: string | Date,
  errorMessage: string = 'Invalid date format'
): Date {
  const date = dateString instanceof Date ? dateString : new Date(dateString)

  if (isNaN(date.getTime())) {
    throw createError({
      statusCode: 400,
      message: errorMessage,
    })
  }

  return date
}

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255, 'Email is too long'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(STRING_LIMITS.userName, 'Name is too long'),
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export const googleAuthSchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
})

// Column definition schema for dynamic inventory
export const columnDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Column name is required').max(STRING_LIMITS.columnName, 'Column name is too long'),
  type: z.enum(['text', 'number', 'currency', 'date', 'select']),
  role: z.enum(['name', 'quantity', 'minQuantity', 'price', 'cost']).optional(),
  options: z.array(z.string().max(STRING_LIMITS.columnName, 'Option value is too long')).optional(),
  required: z.boolean().optional(),
  order: z.number().int().min(0),
})

export const inventorySchemaUpdateSchema = z.object({
  columns: z.array(columnDefinitionSchema),
})

// Dynamic inventory item schema - just validates it's an object
export const dynamicInventoryItemSchema = z.object({
  data: z.record(z.unknown()),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RefreshInput = z.infer<typeof refreshSchema>
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>
export type ColumnDefinitionInput = z.infer<typeof columnDefinitionSchema>
export type InventorySchemaUpdateInput = z.infer<typeof inventorySchemaUpdateSchema>
export type DynamicInventoryItemInput = z.infer<typeof dynamicInventoryItemSchema>

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type PaginationInput = z.infer<typeof paginationSchema>
