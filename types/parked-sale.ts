import type {
  PaymentMethod,
  CardType,
  SplitPaymentEntry,
} from '~/types/operation'

/**
 * Discount type for parked sale items.
 * - 'percent': Percentage discount (0-100)
 * - 'fixed': Fixed amount discount
 */
export type DiscountType = 'percent' | 'fixed'

/**
 * A single item in a parked sale.
 * Contains snapshot data captured at the time of parking.
 */
export interface ParkedSaleItem {
  /** Inventory item ID */
  itemId: string
  /** Item name at time of parking (snapshot) */
  itemName: string
  /** Quantity to sell */
  quantity: number
  /** Price per unit at time of parking */
  pricePerItem: number
  /** Optional discount amount */
  discount?: number
  /** Type of discount applied */
  discountType?: DiscountType
}

/**
 * Single payment state for a parked sale.
 * Captures the payment method and any conditional fields.
 */
export interface ParkedSinglePayment {
  /** Payment method selected */
  method: PaymentMethod
  /** Card type when method is 'CARD' */
  cardType?: CardType
  /** Check number when method is 'CHECK' */
  checkNumber?: string
  /** Cash tendered when method is 'CASH' */
  cashTendered?: number
}

/**
 * Payment mode for parked sales.
 * - 'single': One payment method for the entire sale
 * - 'split': Multiple payment methods
 */
export type PaymentMode = 'single' | 'split'

/**
 * A parked (held) sale that can be recalled later.
 * Contains all state needed to restore the cashier form.
 */
export interface ParkedSale {
  /** Unique identifier (UUID) */
  id: string
  /** ISO timestamp when the sale was parked */
  parkedAt: string
  /** Display label (e.g., "Sale 1", "Sale 2") */
  label: string

  // ─────────────────────────────────────────────────────────────────
  // Items
  // ─────────────────────────────────────────────────────────────────
  /** Items in the sale with snapshot data */
  items: ParkedSaleItem[]

  // ─────────────────────────────────────────────────────────────────
  // Payment State
  // ─────────────────────────────────────────────────────────────────
  /** Whether using single or split payment mode */
  paymentMode: PaymentMode
  /** Single payment data (null when paymentMode is 'split') */
  singlePayment: ParkedSinglePayment | null
  /** Split payment entries (empty when paymentMode is 'single') */
  splitPayments: SplitPaymentEntry[]

  // ─────────────────────────────────────────────────────────────────
  // Form Data
  // ─────────────────────────────────────────────────────────────────
  /** Sale date (ISO date string) */
  date: string
  /** Optional notes */
  notes: string
  /** Optional customer name */
  customer?: string

  // ─────────────────────────────────────────────────────────────────
  // Display Totals (calculated at park time)
  // ─────────────────────────────────────────────────────────────────
  /** Total number of items (sum of quantities) */
  totalItems: number
  /** Grand total after discounts */
  grandTotal: number
}

/**
 * Input data for creating a new parked sale.
 * The id, parkedAt, and label are generated automatically.
 */
export type ParkedSaleInput = Omit<ParkedSale, 'id' | 'parkedAt' | 'label'>

/**
 * Parked sales collection stored in localStorage.
 * Keyed by business ID to support multi-business scenarios.
 */
export interface ParkedSalesStore {
  /** Map of business ID to array of parked sales */
  [businessId: string]: ParkedSale[]
}
