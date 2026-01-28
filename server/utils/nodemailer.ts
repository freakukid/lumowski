import nodemailer, { Transporter } from 'nodemailer'

let transporter: Transporter | null = null

/**
 * Get or create a singleton Nodemailer transporter.
 * Reuses the same SMTP connection across requests for better performance.
 * Uses connection pooling to handle multiple concurrent emails efficiently.
 */
export function getMailTransporter(): Transporter {
  if (transporter) return transporter

  const config = useRuntimeConfig()

  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    throw new Error('SMTP configuration incomplete')
  }

  const port = parseInt(config.smtpPort || '587')

  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port,
    secure: port === 465, // true for 465 (implicit TLS), false for 587 (STARTTLS)
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    pool: true, // Enable connection pooling
    maxConnections: 5,
    maxMessages: 100,
  })

  return transporter
}

/**
 * Get the configured "from" email address.
 * Falls back to a default if not configured.
 */
export function getEmailFromAddress(): string {
  const config = useRuntimeConfig()
  return config.emailFromAddress || 'receipts@lumowski.app'
}
