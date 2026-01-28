import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'
import type { SaleOperationItem } from '~/types/operation'
import { ESCPOS, separator, sendToPrinter } from '~/server/utils/thermal'

/**
 * Zod schema for print receipt request validation.
 */
const printReceiptSchema = z.object({
  operationId: z.string().uuid(),
})

/**
 * Formats currency value for receipt.
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

/**
 * Pads a string to fit within the paper width with price on the right.
 */
function formatLineItem(name: string, price: string, width: number): string {
  const paddingNeeded = width - name.length - price.length
  if (paddingNeeded < 1) {
    // Truncate name if too long
    const maxNameLength = width - price.length - 1
    return `${name.substring(0, maxNameLength)} ${price}`
  }
  return `${name}${' '.repeat(paddingNeeded)}${price}`
}

/**
 * Builds ESC/POS receipt data from operation.
 */
function buildReceiptData(
  operation: {
    id: string
    date: Date
    reference: string | null
    items: SaleOperationItem[]
    totalQty: number
    paymentMethod: string | null
    cardType: string | null
  },
  settings: {
    taxRate: number
    taxName: string
    receiptHeader: string | null
    receiptFooter: string | null
    thermalPrinterWidth: number | null
  },
  businessName: string
): string {
  const width = settings.thermalPrinterWidth || 48
  const lines: string[] = []

  // Initialize printer
  lines.push(ESCPOS.INIT)

  // Header - Business name centered and bold
  lines.push(ESCPOS.ALIGN_CENTER)
  lines.push(ESCPOS.BOLD_ON)
  lines.push(ESCPOS.DOUBLE_HEIGHT_ON)
  lines.push(businessName)
  lines.push(ESCPOS.DOUBLE_HEIGHT_OFF)
  lines.push(ESCPOS.BOLD_OFF)
  lines.push(ESCPOS.FEED_LINE)

  // Custom header text
  if (settings.receiptHeader) {
    lines.push(settings.receiptHeader)
    lines.push(ESCPOS.FEED_LINE)
  }

  // Date and reference
  lines.push(ESCPOS.ALIGN_LEFT)
  lines.push(separator(width))
  const dateStr = new Date(operation.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  lines.push(`Date: ${dateStr}`)
  if (operation.reference) {
    lines.push(`Ref: ${operation.reference}`)
  } else {
    lines.push(`Ref: ${operation.id.slice(0, 8).toUpperCase()}`)
  }
  lines.push(separator(width))
  lines.push(ESCPOS.FEED_LINE)

  // Items
  let subtotal = 0
  let totalDiscount = 0

  for (const item of operation.items as SaleOperationItem[]) {
    // Item name
    lines.push(ESCPOS.BOLD_ON)
    lines.push(item.itemName)
    lines.push(ESCPOS.BOLD_OFF)

    // Quantity x Price = Line Total
    const qtyPriceStr = `  ${item.quantity} x ${formatCurrency(item.pricePerItem)}`
    const lineTotalStr = formatCurrency(item.lineTotal)
    lines.push(formatLineItem(qtyPriceStr, lineTotalStr, width))

    // Discount if applicable
    if (item.discount && item.discount > 0) {
      const discountStr = item.discountType === 'percent'
        ? `-${item.discount}%`
        : `-${formatCurrency(item.discount)}`
      const grossTotal = item.quantity * item.pricePerItem
      const discountAmount = grossTotal - item.lineTotal
      totalDiscount += discountAmount
      lines.push(`    Discount: ${discountStr}`)
    }

    subtotal += item.lineTotal
  }

  lines.push(ESCPOS.FEED_LINE)
  lines.push(separator(width))

  // Totals
  const subtotalStr = formatCurrency(subtotal)
  lines.push(formatLineItem('Subtotal:', subtotalStr, width))

  // Tax
  if (settings.taxRate > 0) {
    const taxAmount = subtotal * (settings.taxRate / 100)
    const taxStr = formatCurrency(taxAmount)
    lines.push(formatLineItem(`${settings.taxName} (${settings.taxRate}%):`, taxStr, width))
    subtotal += taxAmount
  }

  // Grand total
  lines.push(separator(width))
  lines.push(ESCPOS.BOLD_ON)
  lines.push(ESCPOS.DOUBLE_HEIGHT_ON)
  const grandTotalStr = formatCurrency(subtotal)
  lines.push(formatLineItem('TOTAL:', grandTotalStr, width))
  lines.push(ESCPOS.DOUBLE_HEIGHT_OFF)
  lines.push(ESCPOS.BOLD_OFF)
  lines.push(separator(width))

  // Payment method
  if (operation.paymentMethod) {
    let paymentDisplay = operation.paymentMethod
    if (operation.paymentMethod === 'CARD' && operation.cardType) {
      paymentDisplay = `CARD (${operation.cardType})`
    }
    lines.push(ESCPOS.FEED_LINE)
    lines.push(`Paid by: ${paymentDisplay}`)
  }

  // Footer
  lines.push(ESCPOS.FEED_LINE)
  lines.push(ESCPOS.ALIGN_CENTER)
  if (settings.receiptFooter) {
    lines.push(settings.receiptFooter)
    lines.push(ESCPOS.FEED_LINE)
  }

  lines.push('Thank you for your business!')
  lines.push(ESCPOS.FEED_LINES(4))

  // Cut paper
  lines.push(ESCPOS.PARTIAL_CUT)

  return lines.join(ESCPOS.FEED_LINE)
}

/**
 * POST /api/receipt/print
 *
 * Prints a receipt to the configured thermal printer.
 * Uses ESC/POS commands for standard thermal printer compatibility.
 *
 * Request body:
 * - operationId: UUID of the sale operation to print
 *
 * Returns: { success: true, message: string } or error
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload

  requireBusiness(auth.businessId)

  // Validate request body
  const body = await readBody(event)
  const parsed = printReceiptSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request data',
    })
  }

  const { operationId } = parsed.data

  // Get business settings for printer configuration
  const settings = await prisma.businessSettings.findUnique({
    where: { businessId: auth.businessId },
  })

  if (!settings?.thermalPrinterEnabled) {
    throw createError({
      statusCode: 400,
      message: 'Thermal printer is not enabled. Please configure it in business settings.',
    })
  }

  if (!settings.thermalPrinterAddress) {
    throw createError({
      statusCode: 400,
      message: 'Thermal printer address is not configured.',
    })
  }

  // Get operation data
  const operation = await prisma.operation.findUnique({
    where: { id: operationId },
    include: {
      business: true,
    },
  })

  if (!operation) {
    throw createError({
      statusCode: 404,
      message: 'Operation not found',
    })
  }

  requireOperationOwnership(operation, auth.businessId!)

  if (operation.type !== 'SALE') {
    throw createError({
      statusCode: 400,
      message: 'Only sale operations can be printed as receipts',
    })
  }

  try {
    // Build receipt data
    const receiptData = buildReceiptData(
      {
        id: operation.id,
        date: operation.date,
        reference: operation.reference,
        items: operation.items as unknown as SaleOperationItem[],
        totalQty: operation.totalQty,
        paymentMethod: operation.paymentMethod,
        cardType: operation.cardType,
      },
      {
        taxRate: settings.taxRate,
        taxName: settings.taxName,
        receiptHeader: settings.receiptHeader,
        receiptFooter: settings.receiptFooter,
        thermalPrinterWidth: settings.thermalPrinterWidth,
      },
      operation.business.name
    )

    // Send to printer
    await sendToPrinter(
      settings.thermalPrinterAddress,
      settings.thermalPrinterPort || 9100,
      receiptData
    )

    return {
      success: true,
      message: 'Receipt sent to printer',
    }
  } catch (error: unknown) {
    console.error('Thermal print error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to print receipt'
    throw createError({
      statusCode: 500,
      message: errorMessage,
    })
  }
})
