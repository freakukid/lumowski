import { ref, computed } from 'vue'
import type { EmailReceiptPayload, ReceiptApiResponse } from '~/types/receipt'
import { extractApiError } from '~/composables/useApiError'
import { useAuthFetch } from '~/composables/useAuthFetch'

// Module-level cache for heavy library imports
// This avoids re-importing jsPDF and html2canvas on each generatePDF call
let jsPDFModule: typeof import('jspdf') | null = null
let html2canvasModule: typeof import('html2canvas') | null = null

// PDF generation constants
const CANVAS_SCALE = 2 // 2x scale for high-DPI/retina displays
const IMAGE_LOAD_TIMEOUT_MS = 5000 // Max wait time for external images
const RECEIPT_WIDTH_PT = 227 // 80mm thermal receipt width at 72 DPI

/**
 * Composable for receipt generation, printing, and emailing.
 *
 * Provides functionality to:
 * - Generate PDF from HTML element
 * - Print via browser print dialog
 * - Print to thermal printer (via API)
 * - Send receipt via email (via API)
 *
 * @example
 * ```typescript
 * const { generatePDF, printBrowser, printThermal, sendEmail, isLoading, error } = useReceipt()
 *
 * // Generate PDF from receipt element
 * const pdfBase64 = await generatePDF(receiptElement)
 *
 * // Print via browser
 * await printBrowser(receiptElement)
 *
 * // Print to thermal printer
 * await printThermal('operation-id')
 *
 * // Send email with PDF
 * await sendEmail({ operationId: 'op-id', recipientEmail: 'customer@example.com', pdfBase64 })
 * ```
 */
export const useReceipt = () => {
  const { authFetch } = useAuthFetch()

  // Loading states for different operations
  const isGeneratingPDF = ref(false)
  const isPrinting = ref(false)
  const isSendingEmail = ref(false)
  const error = ref<string | null>(null)

  /**
   * Combined loading state for any receipt operation.
   */
  const isLoading = computed(() => isGeneratingPDF.value || isPrinting.value || isSendingEmail.value)

  /**
   * Clears the current error state.
   */
  const clearError = () => {
    error.value = null
  }

  /**
   * Generates a PDF from an HTML element using jspdf and html2canvas.
   * Returns a base64 data URI string of the PDF.
   *
   * @param element - The HTML element to convert to PDF
   * @returns Base64-encoded PDF as data URI string
   */
  const generatePDF = async (element: HTMLElement): Promise<string> => {
    isGeneratingPDF.value = true
    error.value = null

    try {
      // Use cached imports or dynamically import if not yet loaded
      // This avoids re-importing on each generatePDF call while still code-splitting
      if (!jsPDFModule || !html2canvasModule) {
        const [jsPDF, html2canvas] = await Promise.all([
          import('jspdf'),
          import('html2canvas'),
        ])
        jsPDFModule = jsPDF
        html2canvasModule = html2canvas
      }
      const jsPDF = jsPDFModule.default
      const html2canvas = html2canvasModule.default

      // Clone the element to avoid modifying the original
      const clonedElement = element.cloneNode(true) as HTMLElement

      // Create a temporary container for rendering
      const tempContainer = document.createElement('div')
      tempContainer.style.cssText = `
        position: fixed;
        left: 0;
        top: 0;
        width: auto;
        height: auto;
        visibility: visible;
        opacity: 1;
        pointer-events: none;
        z-index: -9999;
        background: white;
      `
      tempContainer.appendChild(clonedElement)
      document.body.appendChild(tempContainer)

      // Wait for images to load (especially the business logo)
      const images = clonedElement.querySelectorAll('img')
      let failedImageCount = 0
      await Promise.all(
        Array.from(images).map((img) => {
          return new Promise<void>((resolve) => {
            if (img.complete && img.naturalHeight > 0) {
              resolve()
            } else {
              img.onload = () => resolve()
              img.onerror = () => {
                // Track failed images and hide them to prevent canvas errors
                failedImageCount++
                console.warn('Receipt image failed to load:', img.src)
                img.style.display = 'none'
                resolve()
              }
              // Add crossorigin attribute for CORS
              if (img.src.startsWith('http')) {
                img.crossOrigin = 'anonymous'
                // Force reload with CORS headers
                const originalSrc = img.src
                img.src = ''
                img.src = originalSrc
              }
            }
          })
        })
      )

      // Warn if any images failed to load
      if (failedImageCount > 0) {
        console.warn(`${failedImageCount} image(s) failed to load in receipt`)
      }

      // Wait for browser to complete layout and paint
      // Double requestAnimationFrame ensures the browser has painted the element
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })

      // Render the element to canvas
      // Note: allowTaint must be false when useCORS is true to avoid tainted canvas
      const canvas = await html2canvas(clonedElement, {
        scale: CANVAS_SCALE,
        useCORS: true, // Allow cross-origin images with CORS headers
        allowTaint: false, // Must be false to allow toDataURL() after CORS images
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: IMAGE_LOAD_TIMEOUT_MS,
        onclone: (clonedDoc: Document) => {
          // Ensure the cloned element is visible in the cloned document
          const clonedTarget = clonedDoc.body.querySelector('.receipt-template') as HTMLElement
          if (clonedTarget) {
            clonedTarget.style.visibility = 'visible'
          }
        },
      })

      // Clean up the temporary container (defensive check in case DOM was modified)
      if (tempContainer.parentNode === document.body) {
        document.body.removeChild(tempContainer)
      }

      // Validate canvas has content
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Failed to capture receipt content. Please try again.')
      }

      // Calculate dimensions for receipt format (80mm wide)
      const imgWidth = RECEIPT_WIDTH_PT
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Create PDF with receipt dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [RECEIPT_WIDTH_PT, imgHeight + 20], // Add some padding
      })

      // Get canvas as image data
      const imgData = canvas.toDataURL('image/png')

      // Validate the image data before adding to PDF
      if (!imgData || imgData === 'data:,' || !imgData.startsWith('data:image/png;base64,')) {
        throw new Error('Failed to convert receipt to image. The canvas may be tainted by cross-origin images.')
      }

      // Add the canvas image to PDF
      pdf.addImage(imgData, 'PNG', 0, 10, imgWidth, imgHeight)

      // Return as base64 data URI
      return pdf.output('datauristring')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate PDF'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      isGeneratingPDF.value = false
    }
  }

  /**
   * Opens the browser print dialog for an HTML element.
   * Creates a new window with print-optimized styles.
   *
   * @param element - The HTML element to print
   */
  const printBrowser = async (element: HTMLElement): Promise<void> => {
    isPrinting.value = true
    error.value = null

    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=400,height=600')

      if (!printWindow) {
        throw new Error('Popup blocked. Please allow popups for this site to print receipts.')
      }

      // Get the receipt HTML content
      const receiptHTML = element.outerHTML

      // Write the print document with styles
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              line-height: 1.4;
              padding: 8px;
              width: 80mm;
              background: white;
              color: black;
            }
            .receipt-template {
              width: 100%;
            }
            .receipt-logo {
              max-width: 60px;
              max-height: 60px;
              margin: 0 auto 8px;
              display: block;
            }
            .receipt-header {
              text-align: center;
              margin-bottom: 12px;
              padding-bottom: 8px;
              border-bottom: 1px dashed #000;
            }
            .receipt-business-name {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .receipt-header-text {
              font-size: 11px;
              white-space: pre-wrap;
            }
            .receipt-info {
              margin-bottom: 12px;
              font-size: 11px;
            }
            .receipt-info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 2px;
            }
            .receipt-items {
              margin-bottom: 12px;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
              padding: 8px 0;
            }
            .receipt-item {
              margin-bottom: 6px;
            }
            .receipt-item-row {
              display: flex;
              justify-content: space-between;
            }
            .receipt-item-name {
              font-weight: bold;
            }
            .receipt-item-details {
              font-size: 10px;
              color: #333;
            }
            .receipt-item-discount {
              font-size: 10px;
              color: #666;
              font-style: italic;
            }
            .receipt-totals {
              margin-bottom: 12px;
            }
            .receipt-total-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
            }
            .receipt-grand-total {
              font-size: 14px;
              font-weight: bold;
              border-top: 1px solid #000;
              padding-top: 4px;
              margin-top: 4px;
            }
            .receipt-payment {
              margin-bottom: 12px;
              padding: 8px 0;
              border-top: 1px dashed #000;
            }
            .receipt-footer {
              text-align: center;
              font-size: 11px;
              padding-top: 8px;
              border-top: 1px dashed #000;
            }
            .receipt-footer-text {
              white-space: pre-wrap;
            }
            .receipt-barcode {
              text-align: center;
              margin-top: 8px;
              font-family: 'Libre Barcode 39', 'Courier New', monospace;
              font-size: 32px;
            }
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          ${receiptHTML}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
              // Fallback for browsers that don't support onafterprint
              setTimeout(function() {
                window.close();
              }, 5000);
            };
          </script>
        </body>
        </html>
      `)

      printWindow.document.close()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to print receipt'
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      isPrinting.value = false
    }
  }

  /**
   * Sends receipt data to thermal printer via server API.
   * The server handles ESC/POS command generation and network communication.
   *
   * @param operationId - The ID of the operation to print
   * @returns Promise resolving when print job is sent
   */
  const printThermal = async (operationId: string): Promise<void> => {
    isPrinting.value = true
    error.value = null

    try {
      const response = await authFetch<ReceiptApiResponse>('/api/receipt/print', {
        method: 'POST',
        body: { operationId },
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to print receipt')
      }
    } catch (err: unknown) {
      const errorMessage = extractApiError(err, 'Failed to send receipt to printer')
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      isPrinting.value = false
    }
  }

  /**
   * Tests the thermal printer connection by sending a test page.
   *
   * @returns Promise resolving when test is complete
   */
  const testThermalPrinter = async (): Promise<void> => {
    isPrinting.value = true
    error.value = null

    try {
      const response = await authFetch<ReceiptApiResponse>('/api/receipt/test-print', {
        method: 'POST',
        body: {},
      })

      if (!response.success) {
        throw new Error(response.error || 'Printer test failed')
      }
    } catch (err: unknown) {
      const errorMessage = extractApiError(err, 'Failed to test printer connection')
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      isPrinting.value = false
    }
  }

  /**
   * Sends a receipt via email with PDF attachment.
   *
   * @param payload - Email payload with operationId, recipientEmail, and pdfBase64
   * @returns Promise resolving when email is sent
   */
  const sendEmail = async (payload: EmailReceiptPayload): Promise<void> => {
    isSendingEmail.value = true
    error.value = null

    try {
      const response = await authFetch<ReceiptApiResponse>('/api/receipt/email', {
        method: 'POST',
        body: payload,
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to send email')
      }
    } catch (err: unknown) {
      const errorMessage = extractApiError(err, 'Failed to send receipt email')
      error.value = errorMessage
      throw new Error(errorMessage)
    } finally {
      isSendingEmail.value = false
    }
  }

  /**
   * Preloads jsPDF and html2canvas libraries in the background.
   * Call this when navigating to pages that may generate receipts.
   * Does nothing if libraries are already cached.
   */
  const preloadLibraries = async (): Promise<void> => {
    if (jsPDFModule && html2canvasModule) return

    // Preload in background without blocking
    Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ]).then(([jsPDF, html2canvas]) => {
      jsPDFModule = jsPDF
      html2canvasModule = html2canvas
    }).catch(() => {
      // Silently fail - will retry on actual use
    })
  }

  return {
    // State
    isLoading,
    isGeneratingPDF,
    isPrinting,
    isSendingEmail,
    error,

    // Methods
    clearError,
    generatePDF,
    printBrowser,
    printThermal,
    testThermalPrinter,
    sendEmail,
    preloadLibraries,
  }
}
