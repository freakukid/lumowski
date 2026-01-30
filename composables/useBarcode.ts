import type { DynamicInventoryItem } from '~/types/schema'

/**
 * Response type from the barcode lookup API.
 */
interface BarcodeLookupResponse {
  found: boolean
  item: DynamicInventoryItem | null
  error?: string
}

// ============================================================================
// Audio Context Caching
// ============================================================================

/**
 * Cached AudioContext instance for playing beep sounds.
 * Reusing the context avoids the overhead of creating a new one per beep
 * and prevents hitting browser limits on concurrent AudioContexts.
 */
let audioContextInstance: AudioContext | null = null

/**
 * Gets or creates a cached AudioContext instance.
 * Handles the browser autoplay policy by resuming suspended contexts.
 *
 * @returns The AudioContext instance, or null if Web Audio API is not supported
 */
function getOrCreateAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return null

    // Create a new context if none exists or if the previous one was closed
    if (!audioContextInstance || audioContextInstance.state === 'closed') {
      audioContextInstance = new AudioContextClass()
    }

    // Resume if suspended (browser autoplay policy)
    if (audioContextInstance.state === 'suspended') {
      audioContextInstance.resume()
    }

    return audioContextInstance
  } catch {
    return null
  }
}

// ============================================================================
// Barcode Lookup Caching
// ============================================================================

/**
 * Cached barcode lookup result with timestamp for TTL enforcement.
 */
interface CachedLookup {
  result: BarcodeLookupResponse
  timestamp: number
}

/**
 * In-memory cache for barcode lookup results.
 * Reduces API calls when the same barcode is scanned multiple times.
 */
const lookupCache = new Map<string, CachedLookup>()

/**
 * Cache time-to-live in milliseconds.
 * Short TTL (1 minute) ensures cache doesn't serve stale data when
 * inventory changes, while still providing benefit for rapid rescans.
 */
const CACHE_TTL_MS = 60 * 1000

/**
 * Retrieves a cached barcode lookup result if it exists and is not expired.
 *
 * @param barcode - The barcode to look up in the cache
 * @returns The cached result if valid, or null if not found/expired
 */
function getCachedLookup(barcode: string): BarcodeLookupResponse | null {
  const cached = lookupCache.get(barcode)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result
  }
  // Clean up expired entry
  lookupCache.delete(barcode)
  return null
}

/**
 * Stores a barcode lookup result in the cache.
 *
 * @param barcode - The barcode key
 * @param result - The lookup result to cache
 */
function setCachedLookup(barcode: string, result: BarcodeLookupResponse): void {
  lookupCache.set(barcode, { result, timestamp: Date.now() })
}

/**
 * Clears all cached barcode lookup results.
 * Should be called when inventory is modified (create, update, delete)
 * to prevent serving stale data.
 */
export function clearBarcodeCache(): void {
  lookupCache.clear()
}

/**
 * Plays a short beep sound on successful scan.
 * Uses Web Audio API for consistent cross-browser support.
 *
 * The beep is a 1200Hz sine wave that fades out quickly (100ms),
 * providing clear auditory feedback without being intrusive.
 * This function fails silently if Web Audio API is not supported.
 *
 * Uses a cached AudioContext for better performance - avoids the overhead
 * of creating a new context per beep and prevents browser limits.
 */
export function playSuccessBeep(): void {
  try {
    const audioContext = getOrCreateAudioContext()
    if (!audioContext) return

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    // Connect oscillator -> gain -> output
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Configure oscillator: 1200Hz sine wave for a pleasant, high-pitched beep
    oscillator.frequency.value = 1200
    oscillator.type = 'sine'

    // Configure gain envelope: start at 0.3 volume, fade to near-zero over 100ms
    // This creates a short, crisp beep that doesn't linger
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

    // Play the beep for 100ms
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1)

    // Note: We keep the AudioContext alive for reuse instead of closing it.
    // The oscillator and gain nodes are automatically cleaned up after stopping.
  } catch {
    // Audio not supported or blocked by browser, fail silently
    // This is expected behavior on some mobile browsers or when autoplay is blocked
  }
}

/**
 * Internal state for tracking keystrokes in scanner detection.
 */
interface ScannerBuffer {
  chars: string[]
  timestamps: number[]
}

/**
 * Configuration for USB barcode scanner detection.
 *
 * USB scanners emulate keyboard input at very high speeds (10-50ms between chars),
 * while humans typically type at 100-300ms between chars. These thresholds
 * distinguish scanner input from human typing.
 */
const SCANNER_CONFIG = {
  /**
   * Maximum milliseconds between characters to consider as continuous input.
   * USB scanners: 10-50ms, Humans: 100-300ms. Using 50ms filters human typing.
   */
  MAX_CHAR_GAP_MS: 50,

  /**
   * Minimum characters for valid barcode. Most barcodes are 8-14 chars.
   * Using 4 allows short codes while filtering accidental keystrokes.
   */
  MIN_BARCODE_LENGTH: 4,

  /**
   * Maximum average ms per character for scanner detection.
   * Scanners average ~20-30ms/char, humans ~100-150ms/char.
   */
  MAX_AVG_TIME_PER_CHAR_MS: 50,
} as const

/**
 * Composable for barcode-related functionality including:
 * - Looking up items by barcode
 * - Detecting USB barcode scanner input
 * - Providing haptic feedback on mobile devices
 *
 * @example
 * ```typescript
 * const { lookupBarcode, createScannerDetector, triggerHapticFeedback } = useBarcode()
 *
 * // Look up an item by barcode
 * const result = await lookupBarcode('123456789')
 * if (result.found) {
 *   console.log('Found item:', result.item)
 * }
 *
 * // Set up scanner detection
 * onMounted(() => {
 *   const cleanup = createScannerDetector((barcode) => {
 *     console.log('Scanned:', barcode)
 *   })
 *   onUnmounted(cleanup)
 * })
 * ```
 */
export function useBarcode() {
  const { authFetch } = useAuthFetch()

  /**
   * Looks up an inventory item by barcode value.
   * Calls the /api/inventory/lookup endpoint.
   *
   * Results are cached for 1 minute to reduce API calls when the same
   * barcode is scanned multiple times. Cache is automatically cleared
   * when inventory is modified.
   *
   * @param barcode - The barcode value to search for
   * @returns Promise resolving to lookup result with found status and optional item
   */
  const lookupBarcode = async (barcode: string): Promise<BarcodeLookupResponse> => {
    // Check cache first to avoid unnecessary API calls
    const cached = getCachedLookup(barcode)
    if (cached) {
      return cached
    }

    const result = await authFetch<BarcodeLookupResponse>('/api/inventory/lookup', {
      query: { barcode },
    })

    // Cache the result for future lookups
    setCachedLookup(barcode, result)

    return result
  }

  /**
   * Creates a keyboard event listener that detects USB barcode scanner input.
   *
   * USB barcode scanners typically send characters very rapidly (much faster than
   * human typing) and end with an Enter key. This function detects that pattern
   * by tracking keystroke timing.
   *
   * Detection algorithm:
   * 1. Buffer keystrokes with their timestamps
   * 2. If the gap between characters exceeds MAX_CHAR_GAP_MS, reset the buffer
   * 3. When Enter is pressed, check if:
   *    - Buffer has at least MIN_BARCODE_LENGTH characters
   *    - Average time per character is below MAX_AVG_TIME_PER_CHAR_MS
   * 4. If conditions are met, call the onScan callback
   *
   * @param onScan - Callback function invoked when a barcode scan is detected
   * @returns Cleanup function to remove the event listener
   */
  const createScannerDetector = (onScan: (barcode: string) => void): (() => void) => {
    const buffer: ScannerBuffer = {
      chars: [],
      timestamps: [],
    }

    /**
     * Resets the buffer to start fresh for a new potential scan.
     */
    const resetBuffer = () => {
      buffer.chars = []
      buffer.timestamps = []
    }

    /**
     * Calculates the average time between keystrokes in the buffer.
     * Returns Infinity if there are fewer than 2 timestamps.
     */
    const getAverageCharTime = (): number => {
      if (buffer.timestamps.length < 2) {
        return Infinity
      }

      const firstTime = buffer.timestamps[0]
      const lastTime = buffer.timestamps[buffer.timestamps.length - 1]
      const totalTime = lastTime - firstTime

      // Average time per character (excluding the first one)
      return totalTime / (buffer.timestamps.length - 1)
    }

    /**
     * Handles keydown events to detect scanner input patterns.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      const now = Date.now()

      // Check if we should reset the buffer due to timeout
      if (buffer.timestamps.length > 0) {
        const lastTimestamp = buffer.timestamps[buffer.timestamps.length - 1]
        if (now - lastTimestamp > SCANNER_CONFIG.MAX_CHAR_GAP_MS) {
          resetBuffer()
        }
      }

      // Handle Enter key - check if we have a valid scan
      if (event.key === 'Enter') {
        const avgTime = getAverageCharTime()
        const hasEnoughChars = buffer.chars.length >= SCANNER_CONFIG.MIN_BARCODE_LENGTH
        const isRapidInput = avgTime <= SCANNER_CONFIG.MAX_AVG_TIME_PER_CHAR_MS

        if (hasEnoughChars && isRapidInput) {
          // This looks like a scanner input - prevent form submission
          event.preventDefault()
          event.stopPropagation()

          const barcode = buffer.chars.join('')
          resetBuffer()
          onScan(barcode)
        } else {
          // Not a scanner input, reset and let the event propagate normally
          resetBuffer()
        }
        return
      }

      // Only track printable characters (single character keys)
      // Ignore modifier keys, function keys, arrow keys, etc.
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        buffer.chars.push(event.key)
        buffer.timestamps.push(now)
      }
    }

    // Add event listener to capture scanner input globally
    // Use capture phase to detect scans before other handlers
    document.addEventListener('keydown', handleKeyDown, { capture: true })

    // Return cleanup function
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }

  /**
   * Triggers haptic feedback on mobile devices if supported.
   * Uses the Vibration API which is available on most mobile browsers.
   *
   * Vibration patterns:
   * - success: 50ms single pulse - short, affirming feedback that feels quick
   *   and responsive. Used when a barcode is successfully scanned and the item
   *   is found in inventory.
   * - error: [100, 50, 100] double pulse - attention-getting pattern that
   *   signals something went wrong. The pause between pulses creates a
   *   distinctive "buzz-buzz" that users learn to recognize as an error.
   *   Used when barcode lookup fails or item is not found.
   *
   * @param type - The type of feedback ('success' or 'error')
   */
  const triggerHapticFeedback = (type: 'success' | 'error'): void => {
    // Check if the Vibration API is available
    if (typeof navigator === 'undefined' || !navigator.vibrate) {
      return
    }

    try {
      if (type === 'success') {
        // Short single vibration for success (50ms)
        navigator.vibrate(50)
      } else {
        // Double vibration pattern for error: 100ms vibrate, 50ms pause, 100ms vibrate
        navigator.vibrate([100, 50, 100])
      }
    } catch {
      // Silently ignore vibration errors (e.g., permission denied)
    }
  }

  return {
    lookupBarcode,
    createScannerDetector,
    triggerHapticFeedback,
  }
}
