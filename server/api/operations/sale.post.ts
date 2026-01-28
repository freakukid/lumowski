import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import type { SaleOperationItem, SaleItemInput, StoredPaymentEntry } from '~/types/operation'
import type { JwtPayload } from '~/server/utils/auth'
import { validateDate, STRING_LIMITS } from '~/server/utils/validation'
import { normalizeStringInput } from '~/server/utils/sanitization'
import { parseColumnDefinitions } from '~/server/utils/apiHelpers'
import { requireBusiness, requireRole } from '~/server/utils/permissions'
import { safeEmitInventoryUpdate } from '~/server/utils/socket'
import { getItemName } from '~/server/utils/inventoryLog'

/**
 * Zod schema for validating financial totals in sale requests.
 * These fields are required for storing transaction details for receipt reprinting.
 */
const financialTotalsSchema = z.object({
  subtotal: z.number().nonnegative(),
  totalDiscount: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
  taxName: z.string().min(1).default('Tax'),
  taxAmount: z.number().nonnegative(),
  grandTotal: z.number().nonnegative(),
  cashTendered: z.number().nonnegative().optional(),
  changeGiven: z.number().nonnegative().optional(),
})

/**
 * POST /api/operations/sale
 * Creates a sale operation that subtracts inventory quantities.
 *
 * Request body (single payment mode - legacy):
 * {
 *   date: string (ISO date),
 *   paymentMethod: 'CASH' | 'CARD' | 'CHECK' | 'OTHER',
 *   cardType?: 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER' (required when paymentMethod is 'CARD'),
 *   checkNumber?: string (optional when paymentMethod is 'CHECK'),
 *   notes?: string,
 *   items: [{ itemId: string, quantity: number, discount?: number, discountType?: 'percent' | 'fixed' }]
 * }
 *
 * Request body (split payment mode):
 * {
 *   date: string (ISO date),
 *   payments: [{ method: 'CASH' | 'CARD' | 'CHECK' | 'OTHER', amount: number, cardType?: string, checkNumber?: string }],
 *   notes?: string,
 *   items: [{ itemId: string, quantity: number, discount?: number, discountType?: 'percent' | 'fixed' }]
 * }
 *
 * This endpoint:
 * 1. Validates all items exist and belong to the business
 * 2. Validates sufficient stock for each item
 * 3. Updates each item's quantity (previousQty - quantity)
 * 4. Creates an Operation record with the full item details including pricing and discount
 * 5. Emits socket events for real-time updates
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload
  const body = await readBody(event)

  requireBusiness(auth.businessId)
  // All staff roles can process sales (OWNER, BOSS, EMPLOYEE)
  requireRole(auth.businessRole, ['OWNER', 'BOSS', 'EMPLOYEE'], 'process sales')

  // Validate request body
  if (!body.date) {
    throw createError({
      statusCode: 400,
      message: 'Date is required',
    })
  }

  // Parse and validate date
  const operationDate = validateDate(body.date)

  // Determine payment mode: split (has payments array) or single (has paymentMethod)
  const isSplitPayment = Array.isArray(body.payments)
  const validPaymentMethods = ['CASH', 'CARD', 'CHECK', 'OTHER']
  const validCardTypes = ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER']

  // Variables to store validated payment data
  let paymentMethod: string | null = null
  let cardType: string | null = null
  let checkNumber: string | null = null
  let storedPayments: StoredPaymentEntry[] | null = null

  if (isSplitPayment) {
    // Validate split payments
    const payments = body.payments as unknown[]
    if (payments.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'At least one payment is required',
      })
    }

    storedPayments = []
    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i] as Record<string, unknown>

      // Validate payment method
      if (!payment.method || !validPaymentMethods.includes(payment.method as string)) {
        throw createError({
          statusCode: 400,
          message: `Payment ${i + 1}: Valid payment method is required (CASH, CARD, CHECK, or OTHER)`,
        })
      }

      // Validate amount
      if (typeof payment.amount !== 'number' || payment.amount < 0) {
        throw createError({
          statusCode: 400,
          message: `Payment ${i + 1}: Amount must be a non-negative number`,
        })
      }

      // Validate cardType when payment method is CARD
      if (payment.method === 'CARD') {
        if (!payment.cardType || !validCardTypes.includes(payment.cardType as string)) {
          throw createError({
            statusCode: 400,
            message: `Payment ${i + 1}: Card type is required when payment method is CARD`,
          })
        }
      }

      // Validate checkNumber is a string if provided when payment method is CHECK
      if (payment.method === 'CHECK' && payment.checkNumber !== undefined) {
        if (typeof payment.checkNumber !== 'string') {
          throw createError({
            statusCode: 400,
            message: `Payment ${i + 1}: Check number must be a string`,
          })
        }
        if ((payment.checkNumber as string).length > STRING_LIMITS.checkNumber) {
          throw createError({
            statusCode: 400,
            message: `Payment ${i + 1}: Check number must be at most ${STRING_LIMITS.checkNumber} characters`,
          })
        }
      }

      // Build stored payment entry
      storedPayments.push({
        method: payment.method as StoredPaymentEntry['method'],
        amount: payment.amount as number,
        ...(payment.method === 'CARD' && payment.cardType
          ? { cardType: payment.cardType as StoredPaymentEntry['cardType'] }
          : {}),
        ...(payment.method === 'CHECK' && payment.checkNumber
          ? { checkNumber: (payment.checkNumber as string).trim() || undefined }
          : {}),
        ...(payment.method === 'CASH' && payment.cashTendered !== undefined
          ? { cashTendered: payment.cashTendered as number }
          : {}),
      })
    }
  } else {
    // Validate single payment method (legacy mode)
    if (!body.paymentMethod || !validPaymentMethods.includes(body.paymentMethod)) {
      throw createError({
        statusCode: 400,
        message: 'Valid payment method is required (CASH, CARD, CHECK, or OTHER)',
      })
    }

    // Validate cardType when payment method is CARD
    if (body.paymentMethod === 'CARD') {
      if (!body.cardType || !validCardTypes.includes(body.cardType)) {
        throw createError({
          statusCode: 400,
          message: 'Card type is required when payment method is CARD (VISA, MASTERCARD, AMEX, or DISCOVER)',
        })
      }
    }

    // Validate checkNumber is a string if provided when payment method is CHECK
    if (body.paymentMethod === 'CHECK' && body.checkNumber !== undefined) {
      if (typeof body.checkNumber !== 'string') {
        throw createError({
          statusCode: 400,
          message: 'Check number must be a string',
        })
      }
      if (body.checkNumber.length > STRING_LIMITS.checkNumber) {
        throw createError({
          statusCode: 400,
          message: `Check number must be at most ${STRING_LIMITS.checkNumber} characters`,
        })
      }
    }

    paymentMethod = body.paymentMethod as string
    cardType = body.paymentMethod === 'CARD' ? (body.cardType as string) : null
    checkNumber = body.paymentMethod === 'CHECK' && typeof body.checkNumber === 'string'
      ? body.checkNumber.trim() || null
      : null
  }

  // Validate items array
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'At least one item is required',
    })
  }

  // Validate each item input
  const itemInputs: SaleItemInput[] = body.items
  for (const item of itemInputs) {
    if (!item.itemId || typeof item.itemId !== 'string') {
      throw createError({
        statusCode: 400,
        message: 'Each item must have a valid itemId',
      })
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      throw createError({
        statusCode: 400,
        message: 'Each item must have a positive integer quantity',
      })
    }
    // Validate discount if provided
    if (item.discount !== undefined) {
      if (typeof item.discount !== 'number' || item.discount < 0) {
        throw createError({
          statusCode: 400,
          message: 'Discount must be a non-negative number',
        })
      }
      if (item.discountType && !['percent', 'fixed'].includes(item.discountType)) {
        throw createError({
          statusCode: 400,
          message: 'Discount type must be either "percent" or "fixed"',
        })
      }
      // Validate percentage discount is between 0 and 100
      if (item.discountType === 'percent' && item.discount > 100) {
        throw createError({
          statusCode: 400,
          message: 'Percentage discount cannot exceed 100%',
        })
      }
    }
  }

  // Validate optional string fields with length limits
  const reference = normalizeStringInput(body.reference)
  const customer = normalizeStringInput(body.customer)
  const notes = normalizeStringInput(body.notes)

  // Validate string lengths
  if (reference && reference.length > STRING_LIMITS.reference) {
    throw createError({
      statusCode: 400,
      message: `Reference must be at most ${STRING_LIMITS.reference} characters`,
    })
  }
  if (customer && customer.length > STRING_LIMITS.customer) {
    throw createError({
      statusCode: 400,
      message: `Customer must be at most ${STRING_LIMITS.customer} characters`,
    })
  }
  if (notes && notes.length > STRING_LIMITS.notes) {
    throw createError({
      statusCode: 400,
      message: `Notes must be at most ${STRING_LIMITS.notes} characters`,
    })
  }

  // Validate financial totals
  const financialTotalsResult = financialTotalsSchema.safeParse({
    subtotal: body.subtotal,
    totalDiscount: body.totalDiscount,
    taxRate: body.taxRate,
    taxName: body.taxName,
    taxAmount: body.taxAmount,
    grandTotal: body.grandTotal,
    cashTendered: body.cashTendered,
    changeGiven: body.changeGiven,
  })

  if (!financialTotalsResult.success) {
    throw createError({
      statusCode: 400,
      message: `Invalid financial data: ${financialTotalsResult.error.issues.map(i => i.message).join(', ')}`,
    })
  }

  const financialTotals = financialTotalsResult.data

  // Get business schema and settings in parallel
  const [schema, businessSettings] = await Promise.all([
    prisma.inventorySchema.findUnique({
      where: { businessId: auth.businessId },
    }),
    prisma.businessSettings.findUnique({
      where: { businessId: auth.businessId },
    }),
  ])

  if (!schema || !schema.columns) {
    throw createError({
      statusCode: 400,
      message: 'Please set up your inventory columns first',
    })
  }

  const columns = parseColumnDefinitions(schema.columns)
  const quantityColumn = columns.find((c) => c.role === 'quantity')
  const priceColumn = columns.find((c) => c.role === 'price')

  if (!quantityColumn) {
    throw createError({
      statusCode: 400,
      message: 'No quantity column defined in schema. Please add a column with the "quantity" role.',
    })
  }

  if (!priceColumn) {
    throw createError({
      statusCode: 400,
      message: 'No price column defined in schema. Please add a column with the "price" role.',
    })
  }

  // Fetch all items in a single query
  const itemIds = itemInputs.map((i) => i.itemId)
  const existingItems = await prisma.inventoryItem.findMany({
    where: {
      id: { in: itemIds },
      businessId: auth.businessId,
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

  // Create a map for quick lookup
  const itemMap = new Map(existingItems.map((item) => [item.id, item]))

  // Validate all items exist and belong to the business
  for (const input of itemInputs) {
    if (!itemMap.has(input.itemId)) {
      throw createError({
        statusCode: 404,
        message: `Item with ID ${input.itemId} not found or does not belong to this business`,
      })
    }
  }

  // Validate sufficient stock for each item
  for (const input of itemInputs) {
    const item = itemMap.get(input.itemId)!
    const data = item.data as Record<string, unknown>
    const currentQty = typeof data[quantityColumn.id] === 'number'
      ? data[quantityColumn.id] as number
      : 0

    if (currentQty < input.quantity) {
      const itemName = getItemName(data, columns) || 'Unknown Item'
      throw createError({
        statusCode: 400,
        message: `Insufficient stock for "${itemName}". Available: ${currentQty}, Requested: ${input.quantity}`,
      })
    }
  }

  // Use a transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    const operationItems: SaleOperationItem[] = []
    const updatedItems: Array<typeof existingItems[0]> = []
    let totalQty = 0

    // Process each item
    for (const input of itemInputs) {
      const item = itemMap.get(input.itemId)!
      const data = item.data as Record<string, unknown>

      // Get current quantity
      const previousQty = typeof data[quantityColumn.id] === 'number'
        ? data[quantityColumn.id] as number
        : 0

      // Subtract quantity for sale
      const newQty = previousQty - input.quantity
      totalQty += input.quantity

      // Get price per item
      const pricePerItem = typeof data[priceColumn.id] === 'number'
        ? data[priceColumn.id] as number
        : 0

      // Validate price is non-negative
      if (pricePerItem < 0) {
        const itemName = getItemName(data, columns) || 'Unknown Item'
        throw createError({
          statusCode: 400,
          message: `Item "${itemName}" has an invalid negative price. Please correct the item price before processing this sale.`,
        })
      }

      // Calculate line total with discount
      const grossTotal = pricePerItem * input.quantity
      let discountAmount = 0

      if (input.discount && input.discount > 0) {
        if (input.discountType === 'percent') {
          discountAmount = grossTotal * (input.discount / 100)
        } else {
          // Fixed discount - validate it doesn't exceed line total
          if (input.discount > grossTotal) {
            const itemName = getItemName(data, columns) || 'Unknown Item'
            throw createError({
              statusCode: 400,
              message: `Fixed discount ($${input.discount.toFixed(2)}) cannot exceed line total ($${grossTotal.toFixed(2)}) for "${itemName}"`,
            })
          }
          discountAmount = input.discount
        }
      }

      const lineTotal = Math.max(0, grossTotal - discountAmount)

      // Update the item's data with the new quantity
      const newData: Record<string, unknown> = {
        ...data,
        [quantityColumn.id]: newQty,
      }

      // Update the item in the database
      const updatedItem = await tx.inventoryItem.update({
        where: { id: input.itemId },
        data: { data: newData as Prisma.InputJsonValue },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })

      updatedItems.push(updatedItem)

      // Build the operation item record
      const itemName = getItemName(data, columns) || 'Unknown Item'
      operationItems.push({
        itemId: input.itemId,
        itemName,
        quantity: input.quantity,
        previousQty,
        newQty,
        pricePerItem,
        discount: input.discount,
        discountType: input.discountType,
        lineTotal,
      })
    }

    // Server-side validation of financial totals (optional but recommended)
    // This helps catch calculation errors from the client
    const epsilon = 0.01 // Allow small floating point tolerance (1 cent)

    // Calculate expected subtotal from items
    const calculatedSubtotal = operationItems.reduce(
      (sum, item) => sum + item.pricePerItem * item.quantity,
      0
    )

    // Calculate expected total discount
    const calculatedDiscount = operationItems.reduce((sum, item) => {
      if (!item.discount || item.discount <= 0) return sum
      const grossTotal = item.pricePerItem * item.quantity
      if (item.discountType === 'percent') {
        return sum + grossTotal * (item.discount / 100)
      }
      return sum + item.discount
    }, 0)

    // Calculate expected tax and grand total
    const calculatedTaxableAmount = Math.max(0, calculatedSubtotal - calculatedDiscount)
    const calculatedTax = calculatedTaxableAmount * (financialTotals.taxRate / 100)
    const calculatedGrandTotal = calculatedTaxableAmount + calculatedTax

    // Verify client calculations match server calculations
    if (Math.abs(financialTotals.subtotal - calculatedSubtotal) > epsilon) {
      throw createError({
        statusCode: 400,
        message: `Subtotal mismatch: expected ${calculatedSubtotal.toFixed(2)}, got ${financialTotals.subtotal.toFixed(2)}`,
      })
    }
    if (Math.abs(financialTotals.totalDiscount - calculatedDiscount) > epsilon) {
      throw createError({
        statusCode: 400,
        message: `Discount mismatch: expected ${calculatedDiscount.toFixed(2)}, got ${financialTotals.totalDiscount.toFixed(2)}`,
      })
    }
    if (Math.abs(financialTotals.grandTotal - calculatedGrandTotal) > epsilon) {
      throw createError({
        statusCode: 400,
        message: `Grand total mismatch: expected ${calculatedGrandTotal.toFixed(2)}, got ${financialTotals.grandTotal.toFixed(2)}`,
      })
    }

    // Create the operation record with all financial and branding data
    const operation = await tx.operation.create({
      data: {
        type: 'SALE',
        date: operationDate,
        reference,
        customer,
        paymentMethod,
        cardType,
        checkNumber,
        payments: storedPayments as unknown as Prisma.InputJsonValue,
        notes,
        items: operationItems as unknown as Prisma.InputJsonValue,
        totalQty,

        // Financial totals
        subtotal: financialTotals.subtotal,
        totalDiscount: financialTotals.totalDiscount,
        taxRate: financialTotals.taxRate,
        taxName: financialTotals.taxName,
        taxAmount: financialTotals.taxAmount,
        grandTotal: financialTotals.grandTotal,

        // Cash payment details (for single payment mode)
        cashTendered: financialTotals.cashTendered ?? null,
        changeGiven: financialTotals.changeGiven ?? null,

        // Business branding snapshot (for receipt reprinting)
        receiptLogoUrl: businessSettings?.logoUrl ?? null,
        receiptHeader: businessSettings?.receiptHeader ?? null,
        receiptFooter: businessSettings?.receiptFooter ?? null,

        businessId: auth.businessId!,
        userId: auth.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return { operation, operationItems, updatedItems }
  })

  // Emit socket events for real-time updates
  safeEmitInventoryUpdate(auth.businessId!, result.operation, result.updatedItems)

  return result.operation
})
