import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { ownerRoute } from '~/server/utils/apiMiddleware'

// IPv4 address validation pattern
const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

const updateSettingsSchema = z.object({
  taxRate: z.number().min(0).max(100).optional(),
  taxName: z.string().min(1).max(50).optional(),
  receiptHeader: z.string().max(500).nullable().optional(),
  receiptFooter: z.string().max(500).nullable().optional(),
  // Thermal printer configuration
  thermalPrinterEnabled: z.boolean().optional(),
  thermalPrinterType: z.string().nullable().optional(),
  thermalPrinterAddress: z.string()
    .regex(ipv4Pattern, 'Invalid IP address')
    .nullable()
    .optional(),
  thermalPrinterPort: z.number().int().min(1).max(65535).nullable().optional(),
  thermalPrinterWidth: z.number().int().min(20).max(80).nullable().optional(),
})

export default ownerRoute(async (event, { businessId }) => {
  const body = await readBody(event)
  const parsed = updateSettingsSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid settings data',
    })
  }

  const {
    taxRate,
    taxName,
    receiptHeader,
    receiptFooter,
    thermalPrinterEnabled,
    thermalPrinterType,
    thermalPrinterAddress,
    thermalPrinterPort,
    thermalPrinterWidth,
  } = parsed.data

  // Upsert settings - create if not exists, update if exists
  const settings = await prisma.businessSettings.upsert({
    where: { businessId },
    create: {
      businessId,
      taxRate: taxRate ?? 0,
      taxName: taxName ?? 'Tax',
      receiptHeader: receiptHeader ?? null,
      receiptFooter: receiptFooter ?? null,
      thermalPrinterEnabled: thermalPrinterEnabled ?? false,
      thermalPrinterType: thermalPrinterType ?? null,
      thermalPrinterAddress: thermalPrinterAddress ?? null,
      thermalPrinterPort: thermalPrinterPort ?? 9100,
      thermalPrinterWidth: thermalPrinterWidth ?? 48,
    },
    update: {
      ...(taxRate !== undefined && { taxRate }),
      ...(taxName !== undefined && { taxName }),
      ...(receiptHeader !== undefined && { receiptHeader }),
      ...(receiptFooter !== undefined && { receiptFooter }),
      ...(thermalPrinterEnabled !== undefined && { thermalPrinterEnabled }),
      ...(thermalPrinterType !== undefined && { thermalPrinterType }),
      ...(thermalPrinterAddress !== undefined && { thermalPrinterAddress }),
      ...(thermalPrinterPort !== undefined && { thermalPrinterPort }),
      ...(thermalPrinterWidth !== undefined && { thermalPrinterWidth }),
    },
  })

  return settings
})
