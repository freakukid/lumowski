import { z } from 'zod'
import type { ColumnDefinition } from '~/types/schema'

/**
 * Creates a validator for a single column based on its type and required status.
 *
 * The key insight is that z.preprocess returns a ZodEffects, and calling .optional().nullable()
 * on a ZodEffects doesn't work as expected - it wraps the effects but the inner validator
 * still fails when it receives undefined.
 *
 * The solution is to make the INNER validator optional/nullable for non-required columns,
 * so when the preprocess returns undefined, the inner validator accepts it.
 */
function createColumnValidator(column: ColumnDefinition, coerce: boolean): z.ZodTypeAny {
  const isOptional = !column.required

  switch (column.type) {
    case 'text': {
      // Build inner validator - make it optional/nullable if column is not required
      let innerValidator: z.ZodTypeAny = z.string()
      if (isOptional) {
        innerValidator = innerValidator.optional().nullable()
      }

      if (coerce) {
        // Coerce numbers and other primitives to strings
        return z.preprocess(
          (val) => {
            if (val === null || val === undefined || val === '') return undefined
            return String(val)
          },
          innerValidator
        )
      }
      return innerValidator
    }

    case 'number':
    case 'currency': {
      // Build inner validator - make it optional/nullable if column is not required
      let innerValidator: z.ZodTypeAny = z.number({ invalid_type_error: 'Expected a number' })
      if (isOptional) {
        innerValidator = innerValidator.optional().nullable()
      }

      if (coerce) {
        // Coerce string numbers to actual numbers, handle empty strings
        return z.preprocess(
          (val) => {
            // Treat empty strings as undefined (for optional fields)
            if (val === '' || val === null || val === undefined) return undefined
            // If already a number, pass through
            if (typeof val === 'number') return val
            // Try to parse string as number
            if (typeof val === 'string') {
              const trimmed = val.trim()
              if (trimmed === '') return undefined
              // Remove currency symbols and thousand separators for parsing
              const cleaned = trimmed.replace(/[$€£¥,\s]/g, '')
              const parsed = Number(cleaned)
              if (!isNaN(parsed)) return parsed
            }
            // Return original value to let Zod handle the error
            return val
          },
          innerValidator
        )
      }
      return innerValidator
    }

    case 'date': {
      // Build inner validator with date refinement
      let innerValidator: z.ZodTypeAny = z.string().refine(
        (val) => !val || !isNaN(Date.parse(val)),
        { message: 'Invalid date format' }
      )
      if (isOptional) {
        innerValidator = innerValidator.optional().nullable()
      }

      if (coerce) {
        // Coerce various date formats to ISO string
        return z.preprocess(
          (val) => {
            if (val === '' || val === null || val === undefined) return undefined
            if (typeof val === 'string') {
              const trimmed = val.trim()
              if (trimmed === '') return undefined
              // Try to parse the date
              const parsed = Date.parse(trimmed)
              if (!isNaN(parsed)) {
                // Convert to ISO string for consistent storage
                return new Date(parsed).toISOString()
              }
            }
            if (val instanceof Date && !isNaN(val.getTime())) {
              return val.toISOString()
            }
            // Return original value to let the refine check fail with proper error
            return val
          },
          innerValidator
        )
      }
      return innerValidator
    }

    case 'select': {
      // Select type remains strict - must match exactly one of the options
      if (column.options && column.options.length > 0) {
        let innerValidator: z.ZodTypeAny = z.enum(column.options as [string, ...string[]])
        if (isOptional) {
          innerValidator = innerValidator.optional().nullable()
        }

        if (coerce) {
          // Still preprocess to handle empty strings as undefined
          return z.preprocess(
            (val) => {
              if (val === '' || val === null || val === undefined) return undefined
              return val
            },
            innerValidator
          )
        }
        return innerValidator
      }

      // Fallback for select with no options
      let validator: z.ZodTypeAny = z.string()
      if (isOptional) {
        validator = validator.optional().nullable()
      }
      return validator
    }

    default: {
      let validator: z.ZodTypeAny = z.unknown()
      if (isOptional) {
        validator = validator.optional().nullable()
      }
      return validator
    }
  }
}

export function createDynamicValidator(columns: ColumnDefinition[], coerce: boolean = false) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const column of columns) {
    shape[column.id] = createColumnValidator(column, coerce)
  }

  return z.object(shape).passthrough()
}

export function validateInventoryData(
  data: Record<string, unknown>,
  columns: ColumnDefinition[],
  coerce: boolean = false
): { success: boolean; data?: Record<string, unknown>; errors?: string[] } {
  const validator = createDynamicValidator(columns, coerce)
  const result = validator.safeParse(data)

  if (!result.success) {
    const errors = result.error.errors.map((err) => {
      const columnId = err.path[0] as string
      const column = columns.find((c) => c.id === columnId)
      const columnName = column?.name || columnId
      return `${columnName}: ${err.message}`
    })
    return { success: false, errors }
  }

  // Return the transformed data (with coerced values) on success
  return { success: true, data: result.data as Record<string, unknown> }
}
