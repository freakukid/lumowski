import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
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
  name: z.string().min(1, 'Column name is required'),
  type: z.enum(['text', 'number', 'currency', 'date', 'select']),
  role: z.enum(['name', 'quantity', 'minQuantity', 'price', 'cost']).optional(),
  options: z.array(z.string()).optional(),
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
