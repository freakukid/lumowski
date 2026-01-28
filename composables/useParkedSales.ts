import type { ParkedSale, ParkedSaleInput } from '~/types/parked-sale'
import { useAuthStore } from '~/stores/auth'

/** Maximum number of parked sales allowed per business */
const MAX_PARKED_SALES = 10

/** Auto-expire parked sales after this many hours */
const AUTO_EXPIRE_HOURS = 24

/** Result type for parkSale operation */
interface ParkSaleResult {
  success: boolean
  error?: string
  sale?: ParkedSale
}

/**
 * Generates the localStorage key for parked sales
 * Scoped by businessId to support multi-business scenarios
 */
function getStorageKey(businessId: string): string {
  return `lumowski-parked-sales-${businessId}`
}

/**
 * Generates a UUID v4 for parked sale IDs
 */
function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Checks if a parked sale has expired based on AUTO_EXPIRE_HOURS
 */
function isExpired(sale: ParkedSale): boolean {
  const parkedTime = new Date(sale.parkedAt).getTime()
  const now = Date.now()
  const expirationMs = AUTO_EXPIRE_HOURS * 60 * 60 * 1000
  return now - parkedTime > expirationMs
}

/**
 * Extracts the numeric part from a label like "Sale 1" -> 1
 * Returns 0 if no number found
 */
function extractLabelNumber(label: string): number {
  const match = label.match(/Sale\s+(\d+)$/i)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Generates the next sequential label based on existing parked sales
 * e.g., if "Sale 1" and "Sale 3" exist, returns "Sale 4"
 */
function generateNextLabel(existingSales: ParkedSale[]): string {
  if (existingSales.length === 0) {
    return 'Sale 1'
  }

  // Find the highest existing label number
  const maxNumber = existingSales.reduce((max, sale) => {
    const num = extractLabelNumber(sale.label)
    return num > max ? num : max
  }, 0)

  return `Sale ${maxNumber + 1}`
}

/**
 * Composable for managing parked sales in localStorage.
 *
 * Parked sales allow cashiers to temporarily hold a sale and start a new one,
 * then retrieve the parked sale later to complete it.
 */
export const useParkedSales = () => {
  const authStore = useAuthStore()

  // Reactive state
  const parkedSales = ref<ParkedSale[]>([])

  // Computed count for badge display
  const parkedSalesCount = computed(() => parkedSales.value.length)

  /**
   * Loads parked sales from localStorage for the current business.
   * Automatically removes expired sales (older than AUTO_EXPIRE_HOURS).
   */
  const loadParkedSales = (): void => {
    const businessId = authStore.businessId
    if (!businessId) {
      parkedSales.value = []
      return
    }

    try {
      const stored = localStorage.getItem(getStorageKey(businessId))
      if (!stored) {
        parkedSales.value = []
        return
      }

      const parsed = JSON.parse(stored) as unknown

      // Validate that we got an array
      if (!Array.isArray(parsed)) {
        console.warn('[useParkedSales] Invalid data in localStorage, expected array')
        parkedSales.value = []
        return
      }

      // Filter out expired sales and validate structure
      const validSales = parsed.filter((sale): sale is ParkedSale => {
        // Basic structure validation
        if (
          typeof sale !== 'object' ||
          sale === null ||
          typeof sale.id !== 'string' ||
          typeof sale.parkedAt !== 'string' ||
          typeof sale.label !== 'string' ||
          !Array.isArray(sale.items)
        ) {
          return false
        }

        // Check expiration
        return !isExpired(sale as ParkedSale)
      })

      parkedSales.value = validSales

      // If we filtered out any sales, save the cleaned list
      if (validSales.length !== parsed.length) {
        saveParkedSales()
      }
    } catch (error) {
      console.error('[useParkedSales] Failed to load from localStorage:', error)
      parkedSales.value = []
    }
  }

  /**
   * Saves the current parked sales to localStorage.
   */
  const saveParkedSales = (): void => {
    const businessId = authStore.businessId
    if (!businessId) {
      return
    }

    try {
      localStorage.setItem(getStorageKey(businessId), JSON.stringify(parkedSales.value))
    } catch (error) {
      console.error('[useParkedSales] Failed to save to localStorage:', error)
    }
  }

  /**
   * Parks a new sale.
   *
   * @param input - The sale data to park (without id, parkedAt, and label)
   * @returns Result object with success status, optional error message, and the created sale
   */
  const parkSale = (input: ParkedSaleInput): ParkSaleResult => {
    // Ensure we have the latest data
    loadParkedSales()

    // Check limit
    if (parkedSales.value.length >= MAX_PARKED_SALES) {
      return {
        success: false,
        error: `Maximum of ${MAX_PARKED_SALES} parked sales reached. Please complete or delete existing parked sales.`,
      }
    }

    // Validate items are present
    if (!input.items || input.items.length === 0) {
      return {
        success: false,
        error: 'Cannot park an empty sale.',
      }
    }

    // Create the parked sale with generated fields
    const sale: ParkedSale = {
      id: generateId(),
      parkedAt: new Date().toISOString(),
      label: generateNextLabel(parkedSales.value),
      ...input,
    }

    // Add to the beginning of the list (most recent first)
    parkedSales.value.unshift(sale)
    saveParkedSales()

    return {
      success: true,
      sale,
    }
  }

  /**
   * Retrieves and removes a parked sale by ID.
   *
   * @param id - The ID of the parked sale to retrieve
   * @returns The parked sale if found, null otherwise
   */
  const retrieveSale = (id: string): ParkedSale | null => {
    // Ensure we have the latest data
    loadParkedSales()

    const index = parkedSales.value.findIndex((sale) => sale.id === id)
    if (index === -1) {
      return null
    }

    // Remove from array and save
    const [sale] = parkedSales.value.splice(index, 1)
    saveParkedSales()

    return sale
  }

  /**
   * Deletes a parked sale by ID without returning it.
   *
   * @param id - The ID of the parked sale to delete
   */
  const deleteSale = (id: string): void => {
    // Ensure we have the latest data
    loadParkedSales()

    const index = parkedSales.value.findIndex((sale) => sale.id === id)
    if (index !== -1) {
      parkedSales.value.splice(index, 1)
      saveParkedSales()
    }
  }

  /**
   * Clears all parked sales for the current business.
   */
  const clearAllParkedSales = (): void => {
    parkedSales.value = []
    saveParkedSales()
  }

  return {
    // State
    parkedSales: computed(() => parkedSales.value),
    parkedSalesCount,

    // Actions
    loadParkedSales,
    saveParkedSales,
    parkSale,
    retrieveSale,
    deleteSale,
    clearAllParkedSales,
  }
}
