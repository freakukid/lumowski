import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import type { ColumnDefinition } from '~/types/schema'
import type { JwtPayload } from '~/server/utils/auth'
import { parseColumnDefinitions } from '~/server/utils/apiHelpers'

/**
 * Sanitize column name - remove special characters
 */
const sanitizeColumnName = (name: string): string => {
  let sanitized = name.trim()
  // Keep alphanumeric, spaces, underscores, hyphens
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s_-]/g, '')
  // Replace multiple spaces with single space
  sanitized = sanitized.replace(/\s+/g, ' ')
  // Limit to 100 characters
  return sanitized.substring(0, 100)
}

/**
 * Schema for new column definitions
 */
const newColumnSchema = z.object({
  name: z.string().min(1, 'Column name is required').max(100, 'Column name is too long').transform(sanitizeColumnName),
  type: z.enum(['text', 'number', 'currency', 'date', 'select']),
  role: z.enum(['name', 'quantity', 'minQuantity', 'price', 'cost', 'barcode']).optional(),
  options: z.array(z.string().max(100)).optional(),
  required: z.boolean().optional(),
})

/**
 * Schema for import items
 */
const importItemSchema = z.object({
  data: z.record(z.unknown()),
})

/**
 * Main request body schema
 */
const importExecuteSchema = z.object({
  items: z.array(importItemSchema).min(1, 'At least one item is required'),
  newColumns: z.array(newColumnSchema).optional(),
})

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload

  requireBusiness(auth.businessId)

  // Verify the user is actually a member of the business they're importing to
  const membership = await prisma.businessMember.findUnique({
    where: {
      businessId_userId: {
        businessId: auth.businessId,
        userId: auth.userId,
      },
    },
  })

  if (!membership) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to import to this business',
    })
  }

  // Only OWNER and BOSS can import inventory items (employees cannot create items)
  requireRole(auth.businessRole, ['OWNER', 'BOSS'], 'import inventory items')

  const body = await readBody(event)

  // Validate request body
  const parseResult = importExecuteSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      message: parseResult.error.errors[0].message,
    })
  }

  const { items, newColumns } = parseResult.data

  // Get current schema
  const existingSchema = await prisma.inventorySchema.findUnique({
    where: { businessId: auth.businessId },
  })

  const existingColumns: ColumnDefinition[] = parseColumnDefinitions(existingSchema?.columns)

  // Build new column definitions in memory (don't persist yet)
  let newColumnDefinitions: ColumnDefinition[] = []
  let columnsForValidation: ColumnDefinition[] = existingColumns

  if (newColumns && newColumns.length > 0) {
    // Require OWNER or BOSS role to add new columns
    requireRole(auth.businessRole, ['OWNER', 'BOSS'], 'add new columns during import')

    // Generate IDs and order for new columns (in memory only)
    const maxOrder = existingColumns.length > 0
      ? Math.max(...existingColumns.map((c) => c.order))
      : -1

    newColumnDefinitions = newColumns.map((col, index) => ({
      id: crypto.randomUUID(),
      name: col.name,
      type: col.type,
      role: col.role,
      options: col.options,
      required: col.required ?? false,
      order: maxOrder + 1 + index,
    }))

    // Merge for validation purposes (not persisted yet)
    columnsForValidation = [...existingColumns, ...newColumnDefinitions]
  }

  if (columnsForValidation.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Please set up your inventory columns first',
    })
  }

  // Build a mapping from placeholder keys (__new__N) to actual column IDs
  const placeholderToColumnId: Map<string, string> = new Map()
  if (newColumnDefinitions.length > 0) {
    for (let i = 0; i < newColumnDefinitions.length; i++) {
      placeholderToColumnId.set(`__new__${i}`, newColumnDefinitions[i].id)
    }
  }

  // Transform item data: replace placeholder keys with actual column IDs
  const transformedItems: { data: Record<string, unknown> }[] = []

  for (const item of items) {
    const transformedData: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(item.data)) {
      // Check if this is a placeholder for a new column
      if (placeholderToColumnId.has(key)) {
        transformedData[placeholderToColumnId.get(key)!] = value
      } else {
        // Regular column ID
        transformedData[key] = value
      }
    }

    transformedItems.push({ data: transformedData })
  }

  // Validate ALL items BEFORE any database writes
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
    total: items.length,
    warningCount: 0,
  }

  const validItems: { data: Record<string, unknown> }[] = []

  for (let i = 0; i < transformedItems.length; i++) {
    const item = transformedItems[i]
    const rowNumber = i + 1

    // Apply sanitization before validation
    const sanitized = sanitizeRow(item.data, columnsForValidation)
    results.warningCount += sanitized.warningCount

    // Validate the sanitized data against the schema (with type coercion enabled)
    const validation = validateInventoryData(sanitized.data, columnsForValidation, true)

    if (!validation.success) {
      results.failed++
      const errorMessages = validation.errors?.join(', ') || 'Validation failed'
      results.errors.push(`Row ${rowNumber}: ${errorMessages}`)
    } else {
      validItems.push({
        data: validation.data!,
      })
    }
  }

  // Only proceed with database writes if there are valid items
  if (validItems.length === 0) {
    // No valid items - return early without creating any columns
    return results
  }

  // Use a transaction to ensure columns and items are created together or not at all
  const hasNewColumns = newColumnDefinitions.length > 0
  const mergedColumns = columnsForValidation

  try {
    // Perform all database operations in a transaction
    const createdItems = await prisma.$transaction(async (tx) => {
      // Step 1: Create/update schema with new columns (if any)
      if (hasNewColumns) {
        await tx.inventorySchema.upsert({
          where: { businessId: auth.businessId! },
          update: { columns: mergedColumns as unknown as Prisma.InputJsonValue },
          create: {
            businessId: auth.businessId!,
            columns: mergedColumns as unknown as Prisma.InputJsonValue,
          },
        })
      }

      // Step 2: Bulk insert valid items
      await tx.inventoryItem.createMany({
        data: validItems.map((item) => ({
          data: item.data as unknown as Prisma.InputJsonValue,
          businessId: auth.businessId!,
          createdById: auth.userId,
        })),
      })

      // Step 3: Fetch created items for socket emission
      // Note: createMany doesn't return the created records, so we fetch them
      const items = await tx.inventoryItem.findMany({
        where: {
          businessId: auth.businessId!,
          createdById: auth.userId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: validItems.length,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      return items
    })

    results.success = createdItems.length

    // Emit socket events for real-time updates (outside transaction)
    for (const item of createdItems) {
      emitInventoryCreated(auth.businessId, item)
    }
  } catch (error) {
    // Transaction failed - try inserting items one by one to identify problematic items
    // Note: If we have new columns, we need to persist them first for individual inserts to work
    if (hasNewColumns) {
      try {
        await prisma.inventorySchema.upsert({
          where: { businessId: auth.businessId! },
          update: { columns: mergedColumns as unknown as Prisma.InputJsonValue },
          create: {
            businessId: auth.businessId!,
            columns: mergedColumns as unknown as Prisma.InputJsonValue,
          },
        })
      } catch (schemaError) {
        // If schema update fails, we can't proceed
        throw createError({
          statusCode: 500,
          message: 'Failed to create new columns',
        })
      }
    }

    // Try inserting items one by one
    for (let i = 0; i < validItems.length; i++) {
      try {
        const item = await prisma.inventoryItem.create({
          data: {
            data: validItems[i].data as unknown as Prisma.InputJsonValue,
            businessId: auth.businessId!,
            createdById: auth.userId,
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })

        results.success++
        emitInventoryCreated(auth.businessId, item)
      } catch (insertError) {
        results.failed++
        const errorMessage = insertError instanceof Error ? insertError.message : 'Insert failed'
        results.errors.push(`Row ${i + 1}: ${errorMessage}`)
      }
    }
  }

  return results
})
