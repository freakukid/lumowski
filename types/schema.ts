// Re-export from organized type files for backward compatibility
export type { BusinessRole, UserBusiness } from './user'
export type { Business, BusinessMember, InviteCode, InviteRole } from './business'

// ============================================================================
// Column Definition Types
// ============================================================================

/**
 * Supported column data types for the dynamic inventory schema.
 */
export type ColumnType = 'text' | 'number' | 'currency' | 'date' | 'select'

/**
 * Semantic roles that columns can have in the inventory system.
 * These roles are used for special handling (e.g., displaying item name, calculating stock status).
 */
export type ColumnRole = 'name' | 'quantity' | 'minQuantity' | 'price' | 'cost'

/**
 * Definition of a single column in the inventory schema.
 */
export interface ColumnDefinition {
  id: string
  name: string
  type: ColumnType
  role?: ColumnRole
  options?: string[]  // For 'select' type columns
  required?: boolean
  order: number
}

// ============================================================================
// Inventory Schema Types
// ============================================================================

/**
 * The complete inventory schema for a business.
 * Defines the structure (columns) for all inventory items.
 */
export interface InventorySchema {
  id: string
  columns: ColumnDefinition[]
  businessId: string
  createdAt: string
  updatedAt: string
}

/**
 * A dynamic inventory item with user-defined data fields.
 * The `data` object contains key-value pairs where keys are column IDs.
 */
export interface DynamicInventoryItem {
  id: string
  data: Record<string, unknown>
  businessId: string
  createdById: string
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    name: string
  }
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Standard pagination metadata for list endpoints.
 */
export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

// ============================================================================
// API Error Types (Deprecated - use types/api.ts)
// ============================================================================

/**
 * Standard API error structure returned by Nuxt/Nitro.
 * Use this for typed error handling in catch blocks.
 *
 * @deprecated Use ApiErrorResponse from '~/types/api' instead.
 */
export interface ApiError {
  data?: {
    message?: string
    statusCode?: number
  }
  statusCode?: number
  message?: string
}

// ============================================================================
// Sorting Types
// ============================================================================

export type SortDirection = 'asc' | 'desc'

export interface SortPreference {
  columnId: string | null  // null = no sorting (server order)
  direction: SortDirection
}

// ============================================================================
// Search Filter Types
// ============================================================================

export type SearchFilterMode = 'all' | 'include' | 'exclude'

export interface SearchFilterPreference {
  mode: SearchFilterMode
  columnIds: string[]  // Selected column IDs for include/exclude
}
