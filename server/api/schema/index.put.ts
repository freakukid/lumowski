import { Prisma } from '@prisma/client'
import prisma from '~/server/utils/prisma'
import type { ColumnDefinition } from '~/types/schema'
import { parseColumnDefinitions } from '~/server/utils/apiHelpers'

export default ownerRoute(async (event, { auth, businessId }) => {
  const body = await readBody(event)

  // Validate columns structure
  const data = validateAndThrow(inventorySchemaUpdateSchema, body)

  // Validate role uniqueness - each role can only be assigned once
  const roles = data.columns
    .filter((c) => c.role)
    .map((c) => c.role)
  if (new Set(roles).size !== roles.length) {
    throw createError({
      statusCode: 400,
      message: 'Each role can only be assigned to one column',
    })
  }

  // Validate select columns have options
  for (const column of data.columns) {
    if (column.type === 'select' && (!column.options || column.options.length === 0)) {
      throw createError({
        statusCode: 400,
        message: `Column "${column.name}" is a select type but has no options`,
      })
    }
  }

  // Get existing schema for comparison
  const existingSchema = await prisma.inventorySchema.findUnique({
    where: { businessId },
  })
  const oldColumns = parseColumnDefinitions(existingSchema?.columns)

  // Upsert schema
  const schema = await prisma.inventorySchema.upsert({
    where: { businessId },
    update: { columns: data.columns as unknown as Prisma.InputJsonValue },
    create: {
      businessId,
      columns: data.columns as unknown as Prisma.InputJsonValue,
    },
  })

  // Log schema changes
  const schemaChanges = diffSchemaChanges(oldColumns, data.columns as ColumnDefinition[])
  if (schemaChanges.length > 0) {
    await createInventoryLog({
      action: 'SCHEMA_UPDATED',
      businessId,
      userId: auth.userId,
      schemaChanges,
      undoable: false, // Schema changes are not undoable
    })
  }

  return schema
}, 'edit schema')
