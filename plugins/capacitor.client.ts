/**
 * Capacitor Plugin for Nuxt
 *
 * Initializes Capacitor and native plugins when running on mobile devices.
 * This plugin runs only on the client side (.client.ts suffix).
 */

export default defineNuxtPlugin(async () => {
  // Only run initialization on the client
  if (import.meta.server) {
    return;
  }

  try {
    const { useCapacitor } = await import('~/composables/useCapacitor');
    const capacitor = useCapacitor();

    // Detect the platform
    await capacitor.detectPlatform();

    // Initialize native plugins if running on a native platform
    if (capacitor.isNative.value) {
      await capacitor.initializeNative();
    }
  } catch {
    // Capacitor not available or failed to initialize
    // This is expected when running in a regular browser
  }
});
