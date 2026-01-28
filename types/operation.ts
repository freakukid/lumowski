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

export type OperationType = 'RECEIVING' | 'SALE' | 'RETURN'

export type PaymentMethod = 'CASH' | 'CARD' | 'CHECK' | 'OTHER'

export type CardType = 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER'

/**
 * Extended payment details for conditional fields.
 * Used when additional payment information is needed beyond the basic method.
 */
export interface PaymentDetails {
  method: PaymentMethod
  /** Required when method === 'CARD' */
  cardType?: CardType
  /** Optional when method === 'CHECK' */
  checkNumber?: string
}

/**
 * Single payment form data used in the cashier.
 * Tracks payment method and all conditional fields.
 */
export interface SinglePaymentData {
  method: PaymentMethod
  /** Card type when method is 'CARD' */
  cardType?: CardType
  /** Check number when method is 'CHECK' */
  checkNumber?: string
  /** Cash amount tendered when method is 'CASH' (for calculating change) */
  cashTendered?: number
}

/**
 * A single payment entry in a split payment scenario.
 * Each entry represents one payment method and amount applied to a sale.
 */
export interface SplitPaymentEntry {
  /** Unique identifier for the payment entry */
  id: string
  /** Payment method for this entry */
  method: PaymentMethod
  /** Amount paid with this method */
  amount: number
  /** Card type when method is 'CARD' */
  cardType?: CardType
  /** Check number when method is 'CHECK' */
  checkNumber?: string
  /** Cash amount tendered (for calculating change when method is 'CASH') */
  cashTendered?: number
}

/**
 * Sale operation item with price and discount information.
 * Extends OperationItem with sale-specific fields.
 */
export interface SaleOperationItem extends OperationItem {
  /** Price per item at time of sale */
  pricePerItem: number
  /** Discount amount (percentage 0-100 or fixed amount) */
  discount?: number
  /** Type of discount applied */
  discountType?: 'percent' | 'fixed'
  /** Calculated line total after discount: (price * qty) - discount */
  lineTotal: number
}

/**
 * Refund method for return operations.
 */
export type RefundMethod = 'CASH' | 'CARD' | 'ORIGINAL_METHOD'

/**
 * Condition of returned items.
 * - resellable: Item can be restocked and sold again
 * - damaged: Item is physically damaged, cannot be resold
 * - defective: Item has a defect, cannot be resold
 */
export type ReturnItemCondition = 'resellable' | 'damaged' | 'defective'

/**
 * Return operation item with condition and refund information.
 * Extends SaleOperationItem with return-specific fields.
 */
export interface ReturnOperationItem extends SaleOperationItem {
  /** Condition of the returned item */
  condition: ReturnItemCondition
  /** Specific reason for returning this item */
  reason?: string
  /** Refund amount for this item (after applying original discount) */
  refundAmount: number
}

/**
 * Stored payment entry in the operation record (without client-side id).
 */
export interface StoredPaymentEntry {
  method: PaymentMethod
  amount: number
  cardType?: CardType
  checkNumber?: string
  cashTendered?: number
}

export interface Operation {
  id: string
  type: OperationType
  date: string
  reference: string | null
  supplier: string | null
  /** Customer name (for SALE operations) */
  customer: string | null
  /** Payment method used (for SALE operations - legacy single payment) */
  paymentMethod: PaymentMethod | null
  /** Card type when paymentMethod is 'CARD' (legacy single payment) */
  cardType: CardType | null
  /** Check number when paymentMethod is 'CHECK' (legacy single payment) */
  checkNumber: string | null
  /** Split payments array (when multiple payment methods are used) */
  payments: StoredPaymentEntry[] | null
  notes: string | null
  items: OperationItem[] | SaleOperationItem[]
  totalQty: number

  // Financial totals (stored at sale time for receipt reprinting)
  /** Sum of (price * qty) before discounts */
  subtotal: number | null
  /** Total discount amount applied */
  totalDiscount: number | null
  /** Tax rate at time of sale (e.g., 8.25) */
  taxRate: number | null
  /** Tax label at time of sale (e.g., "Sales Tax") */
  taxName: string | null
  /** Calculated tax amount */
  taxAmount: number | null
  /** Final total (subtotal - discount + tax) */
  grandTotal: number | null

  // Cash payment details (for single payment mode)
  /** Amount customer gave (for CASH payments) */
  cashTendered: number | null
  /** Change returned to customer */
  changeGiven: number | null

  // Business branding snapshot (for receipt reprinting)
  /** Business logo URL at sale time */
  receiptLogoUrl: string | null
  /** Receipt header text at sale time */
  receiptHeader: string | null
  /** Receipt footer text at sale time */
  receiptFooter: string | null

  // Return-specific fields
  /** For RETURN operations: ID of the original SALE */
  originalSaleId: string | null
  /** Why items are being returned */
  returnReason: string | null
  /** How the refund was issued */
  refundMethod: RefundMethod | null

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

  // Self-referential relationships for Sale <-> Return linking
  /** For RETURN operations: the original SALE operation */
  originalSale?: Operation | null
  /** For SALE operations: list of RETURN operations against this sale */
  returns?: Operation[]
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

/**
 * Input for a single item in a sale operation.
 */
export interface SaleItemInput {
  itemId: string
  quantity: number
  /** Discount amount (percentage 0-100 or fixed amount) */
  discount?: number
  /** Type of discount: 'percent' for percentage, 'fixed' for fixed amount */
  discountType?: 'percent' | 'fixed'
}

/**
 * Input for creating a sale operation with single payment method.
 */
export interface SinglePaymentInput {
  /** Payment method used */
  paymentMethod: PaymentMethod
  /** Card type when paymentMethod is 'CARD' */
  cardType?: CardType
  /** Check number when paymentMethod is 'CHECK' */
  checkNumber?: string
}

/**
 * Input for creating a sale operation with split payments.
 */
export interface SplitPaymentInput {
  /** Array of payment entries when using split payment */
  payments: SplitPaymentEntry[]
}

/**
 * Financial totals for a sale operation.
 * These are calculated on the client and stored for receipt reprinting.
 */
export interface SaleFinancialTotals {
  /** Sum of (price * qty) before discounts */
  subtotal: number
  /** Total discount amount applied */
  totalDiscount: number
  /** Tax rate at time of sale (e.g., 8.25) */
  taxRate: number
  /** Tax label at time of sale (e.g., "Sales Tax") */
  taxName: string
  /** Calculated tax amount */
  taxAmount: number
  /** Final total (subtotal - discount + tax) */
  grandTotal: number
}

/**
 * Cash payment details for single payment mode.
 */
export interface CashPaymentDetails {
  /** Amount customer gave (for CASH payments) */
  cashTendered?: number
  /** Change returned to customer */
  changeGiven?: number
}

/**
 * Input for creating a sale operation.
 * Supports both single payment (legacy) and split payment modes.
 */
export type SaleOperationInput = {
  date: string
  /** Receipt number or transaction ID */
  reference?: string
  /** Customer name */
  customer?: string
  notes?: string
  items: SaleItemInput[]
} & SaleFinancialTotals & CashPaymentDetails & (SinglePaymentInput | SplitPaymentInput)

/**
 * Input for a single item being returned.
 */
export interface ReturnItemInput {
  /** ID of the inventory item being returned */
  itemId: string
  /** Quantity being returned */
  quantity: number
  /** Condition of the returned item */
  condition: ReturnItemCondition
  /** Specific reason for returning this item */
  reason?: string
}

/**
 * Input for creating a return operation.
 */
export interface ReturnOperationInput {
  /** ID of the original sale operation */
  originalSaleId: string
  /** Date of the return */
  date: string
  /** Overall reason for the return */
  reason: string
  /** How the refund will be issued */
  refundMethod: RefundMethod
  /** Card type when refundMethod is 'CARD' */
  cardType?: CardType
  /** Optional notes about the return */
  notes?: string
  /** Items being returned */
  items: ReturnItemInput[]
}

/**
 * Response for returnable items endpoint.
 * Shows which items from a sale can still be returned and in what quantity.
 */
export interface ReturnableItem {
  /** Inventory item ID */
  itemId: string
  /** Item name at time of sale */
  itemName: string
  /** Original quantity sold */
  originalQty: number
  /** Quantity already returned */
  returnedQty: number
  /** Quantity available to return */
  availableQty: number
  /** Original price per item */
  pricePerItem: number
  /** Original discount applied */
  discount?: number
  /** Original discount type */
  discountType?: 'percent' | 'fixed'
  /** Original line total */
  lineTotal: number
}
