/**
 * Barcode Scanner Composable
 *
 * Provides camera-based barcode scanning functionality using html5-qrcode.
 * Wraps the library with a Vue-friendly API including reactive state management,
 * proper cleanup on component unmount, and comprehensive error handling.
 *
 * Features:
 * - Camera-based barcode/QR code scanning
 * - Automatic cleanup on component unmount
 * - Permission state tracking
 * - Flashlight/torch toggle support
 * - Configurable scan box dimensions
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { state, startScanning, stopScanning, toggleFlash } = useBarcodeScanner()
 *
 * const handleScan = (barcode: string) => {
 *   console.log('Scanned:', barcode)
 * }
 *
 * onMounted(() => {
 *   startScanning('scanner-container', handleScan)
 * })
 * </script>
 *
 * <template>
 *   <div id="scanner-container" style="width: 300px; height: 300px;"></div>
 *   <p v-if="state.isInitializing">Initializing camera...</p>
 *   <p v-if="state.error">{{ state.error }}</p>
 * </template>
 * ```
 */

/**
 * Cached reference to the dynamically imported html5-qrcode module.
 * Lazy loading reduces initial bundle size - the library (~200KB) is only
 * loaded when the user actually opens the camera scanner.
 */
let Html5QrcodeModule: typeof import('html5-qrcode') | null = null

/**
 * Lazily loads the html5-qrcode library on first use.
 * Subsequent calls return the cached module immediately.
 *
 * @returns Promise resolving to the html5-qrcode module
 */
async function ensureLibraryLoaded(): Promise<typeof import('html5-qrcode')> {
  if (!Html5QrcodeModule) {
    Html5QrcodeModule = await import('html5-qrcode')
  }
  return Html5QrcodeModule
}

/**
 * State of the barcode scanner.
 */
export interface ScannerState {
  /** Whether the scanner is currently initializing (requesting permissions, starting camera) */
  isInitializing: boolean
  /** Whether the scanner is actively scanning */
  isScanning: boolean
  /** Camera permission status: null = unknown, true = granted, false = denied */
  hasPermission: boolean | null
  /** Current error message, if any */
  error: string | null
  /** Whether the flashlight/torch is currently on */
  isFlashOn: boolean
}

/**
 * Configuration options for the scanner.
 */
export interface ScannerConfig {
  /** Frames per second for scanning. Higher = more responsive but more CPU. Default: 10 */
  fps?: number
  /** Width of the scanning box in pixels. Default: 250 */
  qrboxWidth?: number
  /** Height of the scanning box in pixels. Default: 250 */
  qrboxHeight?: number
  /** Aspect ratio of the video feed. Default: 1.0 */
  aspectRatio?: number
  /** Whether to disable flip (mirror) for front camera. Default: false */
  disableFlip?: boolean
}

/**
 * Default scanner configuration optimized for barcode scanning.
 * - 10 FPS balances responsiveness with battery/CPU usage
 * - 250x250 scan box provides good target area for most barcodes
 * - 1.0 aspect ratio works well for both portrait and landscape orientations
 */
const DEFAULT_CONFIG: Required<ScannerConfig> = {
  fps: 10,
  qrboxWidth: 250,
  qrboxHeight: 250,
  aspectRatio: 1.0,
  disableFlip: false,
}

/**
 * Maps html5-qrcode errors to user-friendly messages.
 * These messages are appropriate for display in the UI.
 */
function getErrorMessage(error: unknown): string {
  const errorStr = String(error)

  // Permission denied by user
  if (errorStr.includes('NotAllowedError') || errorStr.includes('Permission denied')) {
    return 'Camera permission was denied. Please allow camera access in your browser settings to use the scanner.'
  }

  // No camera found on device
  if (errorStr.includes('NotFoundError') || errorStr.includes('Requested device not found')) {
    return 'No camera was found on this device. Please ensure your device has a camera.'
  }

  // Camera already in use by another application
  if (errorStr.includes('NotReadableError') || errorStr.includes('Could not start video source')) {
    return 'Camera is in use by another application. Please close other apps using the camera and try again.'
  }

  // Insecure context (not HTTPS)
  if (errorStr.includes('SecurityError') || errorStr.includes('Only secure origins')) {
    return 'Camera access requires a secure connection (HTTPS). Please access this page over HTTPS.'
  }

  // Browser doesn't support getUserMedia
  if (errorStr.includes('NotSupportedError') || errorStr.includes('getUserMedia is not implemented')) {
    return 'Your browser does not support camera access. Please use a modern browser like Chrome, Firefox, or Safari.'
  }

  // Overconstrained (requested constraints cannot be satisfied)
  if (errorStr.includes('OverconstrainedError')) {
    return 'The requested camera settings are not supported by your device.'
  }

  // Generic fallback for unknown errors
  return 'Failed to access camera. Please check your camera permissions and try again.'
}

/**
 * Composable for camera-based barcode scanning.
 *
 * Uses html5-qrcode library for cross-browser barcode detection.
 * Supports multiple barcode formats including UPC, EAN, Code128, QR codes, etc.
 *
 * @param config - Optional configuration overrides
 * @returns Scanner state and control functions
 */
export function useBarcodeScanner(config: ScannerConfig = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  const state = ref<ScannerState>({
    isInitializing: false,
    isScanning: false,
    hasPermission: null,
    error: null,
    isFlashOn: false,
  })

  // Scanner instance - kept outside reactive state to avoid proxy issues
  // Using InstanceType with typeof to get the class instance type from the dynamic import
  let scanner: InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null = null
  let onScanCallback: ((barcode: string) => void) | null = null
  // Track the element ID for potential re-initialization
  let currentElementId: string | null = null

  /**
   * Start camera scanning in the specified HTML element.
   *
   * @param elementId - ID of the HTML element to render the camera feed into.
   *                    The element should have explicit width/height set.
   * @param onScan - Callback function invoked when a barcode is successfully decoded.
   *                 Receives the decoded barcode string as the argument.
   * @throws Never throws - errors are captured in state.error
   */
  async function startScanning(
    elementId: string,
    onScan: (barcode: string) => void
  ): Promise<void> {
    // Prevent multiple simultaneous start attempts
    if (state.value.isInitializing || state.value.isScanning) {
      return
    }

    state.value.isInitializing = true
    state.value.error = null
    onScanCallback = onScan
    currentElementId = elementId

    try {
      // Lazy load the html5-qrcode library on first use
      const { Html5Qrcode, Html5QrcodeScannerState } = await ensureLibraryLoaded()

      // Clean up any existing scanner instance
      if (scanner) {
        try {
          const scannerState = scanner.getState()
          if (scannerState === Html5QrcodeScannerState.SCANNING) {
            await scanner.stop()
          }
        } catch {
          // Ignore cleanup errors
        }
        scanner = null
      }

      // Create new scanner instance
      scanner = new Html5Qrcode(elementId)

      // Configure scanner settings
      const scanConfig = {
        fps: mergedConfig.fps,
        qrbox: {
          width: mergedConfig.qrboxWidth,
          height: mergedConfig.qrboxHeight,
        },
        aspectRatio: mergedConfig.aspectRatio,
        disableFlip: mergedConfig.disableFlip,
      }

      // Start scanning with back camera (environment facing)
      await scanner.start(
        { facingMode: 'environment' },
        scanConfig,
        (decodedText: string) => {
          // Successfully decoded a barcode
          onScanCallback?.(decodedText)
        },
        () => {
          // Scan frame error - this fires constantly when no barcode is in view
          // Intentionally ignored as this is normal behavior
        }
      )

      // Successfully started - update state
      state.value.isScanning = true
      state.value.hasPermission = true
      state.value.isInitializing = false
    } catch (error) {
      // Handle initialization errors
      state.value.isInitializing = false
      state.value.isScanning = false
      state.value.error = getErrorMessage(error)

      // Update permission state based on error type
      const errorStr = String(error)
      if (errorStr.includes('NotAllowedError') || errorStr.includes('Permission denied')) {
        state.value.hasPermission = false
      }

      // Clean up failed scanner instance
      if (scanner) {
        try {
          await scanner.clear()
        } catch {
          // Ignore cleanup errors
        }
        scanner = null
      }
    }
  }

  /**
   * Stop camera scanning and release all resources.
   *
   * Safe to call multiple times or when scanner is not running.
   * Clears the camera feed from the DOM element.
   */
  async function stopScanning(): Promise<void> {
    if (!scanner) {
      return
    }

    try {
      // Only need to check scanner state if library is loaded
      // If we have a scanner instance, the library must be loaded
      const { Html5QrcodeScannerState } = await ensureLibraryLoaded()

      // Check if scanner is actually running before stopping
      const scannerState = scanner.getState()
      if (scannerState === Html5QrcodeScannerState.SCANNING) {
        await scanner.stop()
      }
      // Clear the scanner element
      await scanner.clear()
    } catch {
      // Ignore errors during cleanup - they're typically benign
    } finally {
      scanner = null
      onScanCallback = null
      currentElementId = null
      state.value.isScanning = false
      state.value.isFlashOn = false
      // Preserve permission state and don't clear errors during stop
    }
  }

  /**
   * Toggle the camera flashlight/torch.
   *
   * Note: Flash support depends on the device and browser.
   * Not all devices support torch mode, especially front cameras.
   *
   * @returns The new flash state (true = on, false = off).
   *          Returns false if flash is not supported or scanner is not running.
   */
  async function toggleFlash(): Promise<boolean> {
    if (!scanner || !state.value.isScanning) {
      return false
    }

    try {
      // Check if torch/flash is supported
      const capabilities = scanner.getRunningTrackCameraCapabilities()
      if (!capabilities.torchFeature().isSupported()) {
        // Flash not supported - silently return current state
        return state.value.isFlashOn
      }

      // Toggle the flash
      const newFlashState = !state.value.isFlashOn
      if (newFlashState) {
        await capabilities.torchFeature().apply(true)
      } else {
        await capabilities.torchFeature().apply(false)
      }

      state.value.isFlashOn = newFlashState
      return newFlashState
    } catch {
      // Flash toggle failed - return current state
      return state.value.isFlashOn
    }
  }

  /**
   * Check if the device has torch/flash capability.
   *
   * @returns true if flash is available, false otherwise
   */
  function hasFlashSupport(): boolean {
    if (!scanner || !state.value.isScanning) {
      return false
    }

    try {
      const capabilities = scanner.getRunningTrackCameraCapabilities()
      return capabilities.torchFeature().isSupported()
    } catch {
      return false
    }
  }

  /**
   * Get available cameras on the device.
   *
   * Useful for allowing users to switch between front and back cameras.
   * Note: Requires camera permissions to be granted first.
   *
   * @returns Array of camera devices with id and label
   */
  async function getCameras(): Promise<Array<{ id: string; label: string }>> {
    try {
      const { Html5Qrcode } = await ensureLibraryLoaded()
      const devices = await Html5Qrcode.getCameras()
      return devices.map((device) => ({
        id: device.id,
        label: device.label || `Camera ${device.id.slice(0, 8)}`,
      }))
    } catch {
      return []
    }
  }

  /**
   * Switch to a specific camera by device ID.
   *
   * @param cameraId - The camera device ID to switch to
   * @param onScan - Callback for barcode detection (required as scanner restarts)
   */
  async function switchCamera(
    cameraId: string,
    onScan: (barcode: string) => void
  ): Promise<void> {
    if (!currentElementId) {
      state.value.error = 'No active scanner session. Start scanning first.'
      return
    }

    const elementId = currentElementId

    // Stop current scanner
    await stopScanning()

    state.value.isInitializing = true
    state.value.error = null
    onScanCallback = onScan
    currentElementId = elementId

    try {
      // Lazy load the html5-qrcode library
      const { Html5Qrcode } = await ensureLibraryLoaded()

      scanner = new Html5Qrcode(elementId)

      const scanConfig = {
        fps: mergedConfig.fps,
        qrbox: {
          width: mergedConfig.qrboxWidth,
          height: mergedConfig.qrboxHeight,
        },
        aspectRatio: mergedConfig.aspectRatio,
        disableFlip: mergedConfig.disableFlip,
      }

      // Start with specific camera ID instead of facingMode
      await scanner.start(
        cameraId,
        scanConfig,
        (decodedText: string) => {
          onScanCallback?.(decodedText)
        },
        () => {
          // Intentionally ignored
        }
      )

      state.value.isScanning = true
      state.value.hasPermission = true
      state.value.isInitializing = false
    } catch (error) {
      state.value.isInitializing = false
      state.value.isScanning = false
      state.value.error = getErrorMessage(error)

      if (scanner) {
        try {
          await scanner.clear()
        } catch {
          // Ignore cleanup errors
        }
        scanner = null
      }
    }
  }

  // Cleanup on component unmount to prevent memory leaks and camera staying on
  onUnmounted(() => {
    stopScanning()
  })

  return {
    /** Reactive scanner state */
    state: readonly(state),
    /** Start camera scanning */
    startScanning,
    /** Stop camera scanning */
    stopScanning,
    /** Toggle flashlight/torch */
    toggleFlash,
    /** Check if flash is supported */
    hasFlashSupport,
    /** Get list of available cameras */
    getCameras,
    /** Switch to a specific camera */
    switchCamera,
  }
}
