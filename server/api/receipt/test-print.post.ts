import prisma from '~/server/utils/prisma'
import type { JwtPayload } from '~/server/utils/auth'
import { ESCPOS, separator, sendToPrinter } from '~/server/utils/thermal'

/**
 * Builds test page ESC/POS data.
 */
function buildTestPage(businessName: string, width: number): string {
  const lines: string[] = []
  const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  // Initialize printer
  lines.push(ESCPOS.INIT)

  // Header
  lines.push(ESCPOS.ALIGN_CENTER)
  lines.push(ESCPOS.BOLD_ON)
  lines.push(ESCPOS.DOUBLE_HEIGHT_ON)
  lines.push('PRINTER TEST')
  lines.push(ESCPOS.DOUBLE_HEIGHT_OFF)
  lines.push(ESCPOS.BOLD_OFF)
  lines.push(ESCPOS.FEED_LINE)
  lines.push(separator(width))
  lines.push(ESCPOS.FEED_LINE)

  // Business info
  lines.push(ESCPOS.ALIGN_LEFT)
  lines.push(`Business: ${businessName}`)
  lines.push(`Test Time: ${timestamp}`)
  lines.push(ESCPOS.FEED_LINE)
  lines.push(separator(width))
  lines.push(ESCPOS.FEED_LINE)

  // Paper width test
  lines.push('Paper Width Test:')
  lines.push(ESCPOS.FEED_LINE)
  lines.push('0'.repeat(Math.min(width, 10)))
  if (width > 10) {
    lines.push('0123456789'.repeat(Math.floor(width / 10)).substring(0, width))
  }
  lines.push(ESCPOS.FEED_LINE)
  lines.push(separator(width))
  lines.push(ESCPOS.FEED_LINE)

  // Character test
  lines.push('Character Test:')
  lines.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
  lines.push('abcdefghijklmnopqrstuvwxyz')
  lines.push('0123456789')
  lines.push('!@#$%^&*()_+-=[]{}|;:,.<>?')
  lines.push(ESCPOS.FEED_LINE)
  lines.push(separator(width))
  lines.push(ESCPOS.FEED_LINE)

  // Format test
  lines.push('Format Test:')
  lines.push(ESCPOS.BOLD_ON)
  lines.push('This text is BOLD')
  lines.push(ESCPOS.BOLD_OFF)
  lines.push('This text is normal')
  lines.push(ESCPOS.DOUBLE_HEIGHT_ON)
  lines.push('Double Height')
  lines.push(ESCPOS.DOUBLE_HEIGHT_OFF)
  lines.push(ESCPOS.FEED_LINE)
  lines.push(separator(width))
  lines.push(ESCPOS.FEED_LINE)

  // Alignment test
  lines.push(ESCPOS.ALIGN_LEFT)
  lines.push('Left aligned')
  lines.push(ESCPOS.ALIGN_CENTER)
  lines.push('Center aligned')
  lines.push(ESCPOS.ALIGN_LEFT)
  lines.push(ESCPOS.FEED_LINE)
  lines.push(separator(width))
  lines.push(ESCPOS.FEED_LINE)

  // Success message
  lines.push(ESCPOS.ALIGN_CENTER)
  lines.push(ESCPOS.BOLD_ON)
  lines.push('TEST SUCCESSFUL')
  lines.push(ESCPOS.BOLD_OFF)
  lines.push(ESCPOS.FEED_LINE)
  lines.push('Your printer is working correctly!')
  lines.push(ESCPOS.FEED_LINES(4))

  // Cut paper
  lines.push(ESCPOS.PARTIAL_CUT)

  return lines.join(ESCPOS.FEED_LINE)
}

/**
 * POST /api/receipt/test-print
 *
 * Sends a test page to the configured thermal printer.
 * Useful for verifying printer configuration and connectivity.
 *
 * Returns: { success: true, message: string } or error
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload

  requireBusiness(auth.businessId)
  requireRole(auth.businessRole, ['OWNER'], 'test thermal printer')

  // Get business settings for printer configuration
  const settings = await prisma.businessSettings.findUnique({
    where: { businessId: auth.businessId },
    include: {
      business: true,
    },
  })

  if (!settings?.thermalPrinterEnabled) {
    throw createError({
      statusCode: 400,
      message: 'Thermal printer is not enabled. Please enable it in business settings.',
    })
  }

  if (!settings.thermalPrinterAddress) {
    throw createError({
      statusCode: 400,
      message: 'Thermal printer address is not configured.',
    })
  }

  try {
    // Build test page data
    const testPageData = buildTestPage(
      settings.business.name,
      settings.thermalPrinterWidth || 48
    )

    // Send to printer
    await sendToPrinter(
      settings.thermalPrinterAddress,
      settings.thermalPrinterPort || 9100,
      testPageData
    )

    return {
      success: true,
      message: 'Test page sent to printer successfully',
    }
  } catch (error: unknown) {
    console.error('Thermal print test error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to send test page to printer'
    throw createError({
      statusCode: 500,
      message: errorMessage,
    })
  }
})
