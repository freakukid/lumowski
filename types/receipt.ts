/**
 * Represents a single item on a receipt.
 */
export interface ReceiptItem {
  /** Item name displayed on receipt */
  name: string
  /** Quantity sold */
  quantity: number
  /** Price per unit */
  unitPrice: number
  /** Discount amount (percentage 0-100 or fixed amount) */
  discount?: number
  /** Type of discount: 'percent' for percentage, 'fixed' for fixed amount */
  discountType?: 'percent' | 'fixed'
  /** Line total after discount */
  total: number
}

/**
 * Payload for sending a receipt via email.
 */
export interface EmailReceiptPayload {
  /** The operation ID for the sale */
  operationId: string
  /** Customer email address to send receipt to */
  recipientEmail: string
  /** Base64-encoded PDF data (data URI format) */
  pdfBase64: string
}

/**
 * Payload for thermal printer test.
 */
export interface ThermalPrintTestPayload {
  /** Optional custom test message */
  testMessage?: string
}

/**
 * Payload for thermal printing a receipt.
 */
export interface ThermalPrintPayload {
  /** The operation ID for the sale to print */
  operationId: string
}

/**
 * Response from receipt API operations.
 */
export interface ReceiptApiResponse {
  success: boolean
  message?: string
  error?: string
}
