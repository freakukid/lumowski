import type { Pagination } from '~/types/schema'

export interface OperationItem {
  itemId: string
  itemName: string
  quantity: number
  previousQty: number
  newQty: number
  /** Cost per item for this batch (only present when cost tracking is enabled) */
  costPerItem?: number
  /** Previous average cost before this operation */
  previousCost?: number
  /** New weighted average cost after this operation */
  newCost?: number
}

export type OperationType = 'RECEIVING'

export interface Operation {
  id: string
  type: OperationType
  date: string
  reference: string | null
  supplier: string | null
  notes: string | null
  items: OperationItem[]
  totalQty: number
  createdAt: string
  updatedAt: string
  businessId: string
  userId: string
  user: {
    id: string
    name: string
  }
  undoneAt: string | null
  undoneById: string | null
  undoneBy?: {
    id: string
    name: string
  } | null
}

export interface OperationListResponse {
  operations: Operation[]
  pagination: Pagination
}

export interface ReceivingItemInput {
  itemId: string
  quantity: number
  /** Optional cost per item for this batch (for weighted average cost calculation) */
  costPerItem?: number
}

export interface ReceivingOperationInput {
  date: string
  reference?: string
  supplier?: string
  notes?: string
  items: ReceivingItemInput[]
}
