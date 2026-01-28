import { Socket } from 'net'

/**
 * ESC/POS command constants for thermal printers.
 */
const ESC = '\x1B'
const GS = '\x1D'
const LF = '\x0A'

/**
 * ESC/POS commands for thermal printing.
 */
export const ESCPOS = {
  // Initialize printer
  INIT: `${ESC}@`,
  // Text alignment
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  // Text formatting
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_HEIGHT_ON: `${GS}!\x10`,
  DOUBLE_HEIGHT_OFF: `${GS}!\x00`,
  DOUBLE_WIDTH_ON: `${GS}!\x20`,
  DOUBLE_WIDTH_OFF: `${GS}!\x00`,
  // Paper operations
  CUT: `${GS}V\x00`,
  PARTIAL_CUT: `${GS}V\x01`,
  FEED_LINE: LF,
  FEED_LINES: (n: number) => `${ESC}d${String.fromCharCode(n)}`,
}

/**
 * Creates a dashed separator line.
 */
export function separator(width: number): string {
  return '-'.repeat(width)
}

/**
 * Sends data to thermal printer via TCP socket.
 */
export async function sendToPrinter(address: string, port: number, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new Socket()
    const timeout = 10000 // 10 second timeout

    socket.setTimeout(timeout)

    socket.on('error', (err) => {
      socket.destroy()
      reject(new Error(`Printer connection error: ${err.message}`))
    })

    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error('Printer connection timed out'))
    })

    socket.connect(port, address, () => {
      socket.write(data, 'binary', (err) => {
        if (err) {
          socket.destroy()
          reject(new Error(`Failed to send data to printer: ${err.message}`))
          return
        }

        // Give printer time to process before closing
        setTimeout(() => {
          socket.end()
          resolve()
        }, 500)
      })
    })
  })
}
