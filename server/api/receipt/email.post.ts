import { z } from 'zod'
import prisma from '~/server/utils/prisma'
import { getMailTransporter, getEmailFromAddress } from '~/server/utils/nodemailer'
import type { JwtPayload } from '~/server/utils/auth'

/** Maximum allowed PDF size: 10MB */
const MAX_PDF_SIZE = 10 * 1024 * 1024

/**
 * Zod schema for email receipt request validation.
 */
const emailReceiptSchema = z.object({
  operationId: z.string().uuid(),
  recipientEmail: z.string().email(),
  pdfBase64: z.string().min(1),
})

/**
 * POST /api/receipt/email
 *
 * Sends a receipt email with PDF attachment to the specified recipient.
 * Uses Nodemailer with SMTP for email delivery.
 *
 * Request body:
 * - operationId: UUID of the sale operation
 * - recipientEmail: Email address to send receipt to
 * - pdfBase64: Base64-encoded PDF (data URI format)
 *
 * Returns: { success: true, message: string } or error
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth as JwtPayload

  requireBusiness(auth.businessId)

  // Validate request body
  const body = await readBody(event)
  const parsed = emailReceiptSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid request data',
    })
  }

  const { operationId, recipientEmail, pdfBase64 } = parsed.data

  // Verify operation belongs to the user's business
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

  // Extract PDF data from base64 data URI
  // Format: data:application/pdf;base64,<base64-data>
  // Note: jsPDF adds filename parameter: data:application/pdf;filename=generated.pdf;base64,<data>
  const base64Match = pdfBase64.match(/^data:application\/pdf;(?:filename=[^;]+;)?base64,(.+)$/)
  if (!base64Match) {
    throw createError({
      statusCode: 400,
      message: 'Invalid PDF format. Expected base64 data URI.',
    })
  }

  const pdfBuffer = Buffer.from(base64Match[1], 'base64')

  // Validate PDF size to prevent memory exhaustion
  if (pdfBuffer.length > MAX_PDF_SIZE) {
    throw createError({
      statusCode: 413,
      message: `PDF file too large. Maximum size is ${MAX_PDF_SIZE / 1024 / 1024}MB.`,
    })
  }

  const businessName = operation.business.name
  const receiptDate = new Date(operation.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  try {
    // Get singleton transporter (connection pooling enabled)
    const transporter = getMailTransporter()
    const fromAddress = getEmailFromAddress()

    await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: `Receipt from ${businessName} - ${receiptDate}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Thank you for your purchase!</h1>
          <p>Please find your receipt attached to this email.</p>
          <p style="color: #666; margin-top: 20px;">
            <strong>Business:</strong> ${businessName}<br>
            <strong>Date:</strong> ${receiptDate}<br>
            <strong>Reference:</strong> ${operation.reference || operation.id.slice(0, 8).toUpperCase()}
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            This email was sent from ${businessName} via Lumowski Inventory Management.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `receipt-${operation.id.slice(0, 8)}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    })

    return {
      success: true,
      message: `Receipt sent to ${recipientEmail}`,
    }
  } catch (error: unknown) {
    console.error('Email send error:', error)

    // Re-throw if it's already an H3 error
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Failed to send receipt email',
    })
  }
})
