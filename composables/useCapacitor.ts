/**
 * Capacitor Composable
 *
 * Provides utilities for detecting and working with Capacitor native environment.
 * Handles platform detection, native plugin initialization, and platform-specific behavior.
 *
 * NOTE: All Capacitor imports use a dynamic import helper to prevent Vite from
 * trying to resolve them at build time when the packages aren't installed.
 */

import { ref, computed, readonly } from 'vue';

/**
 * Helper to dynamically import Capacitor packages without Vite trying to resolve them.
 * Uses string concatenation to prevent static analysis.
 */
async function tryImportCapacitor<T>(packageName: string): Promise<T | null> {
  try {
    // The '@capacitor/' prefix is split to prevent Vite from statically analyzing the import
    const prefix = '@capaci' + 'tor/';
    return await import(/* @vite-ignore */ prefix + packageName) as T;
  } catch {
    return null;
  }
}

export interface CapacitorPlatformInfo {
  /** Whether the app is running in a Capacitor native container */
  isNative: boolean;
  /** The platform: 'ios', 'android', or 'web' */
  platform: 'ios' | 'android' | 'web';
  /** Whether running on iOS */
  isIOS: boolean;
  /** Whether running on Android */
  isAndroid: boolean;
  /** Whether running on web (not native) */
  isWeb: boolean;
}

// Track if Capacitor plugins have been initialized
const isInitialized = ref(false);
const platformInfo = ref<CapacitorPlatformInfo>({
  isNative: false,
  platform: 'web',
  isIOS: false,
  isAndroid: false,
  isWeb: true,
});

// Store listener handles for cleanup
let keyboardShowListener: { remove: () => Promise<void> } | null = null;
let keyboardHideListener: { remove: () => Promise<void> } | null = null;

/**
 * Composable for Capacitor native functionality
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { isNative, platform, initializeNative, hapticFeedback } = useCapacitor();
 *
 * onMounted(async () => {
 *   if (isNative.value) {
 *     await initializeNative();
 *   }
 * });
 *
 * const handleTap = async () => {
 *   await hapticFeedback('light');
 * };
 * </script>
 * ```
 */
export function useCapacitor() {
  /**
   * Detects the current platform
   * Call this early in app initialization
   */
  const detectPlatform = async (): Promise<CapacitorPlatformInfo> => {
    const capacitorCore = await tryImportCapacitor<{ Capacitor: { isNativePlatform: () => boolean; getPlatform: () => string } }>('core');

    if (capacitorCore?.Capacitor) {
      const { Capacitor } = capacitorCore;
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

      platformInfo.value = {
        isNative,
        platform,
        isIOS: platform === 'ios',
        isAndroid: platform === 'android',
        isWeb: platform === 'web',
      };
    } else {
      // Capacitor not available, default to web
      platformInfo.value = {
        isNative: false,
        platform: 'web',
        isIOS: false,
        isAndroid: false,
        isWeb: true,
      };
    }

    return platformInfo.value;
  };

  /**
   * Initialize native plugins
   * Should be called once when the app starts on native platforms
   */
  const initializeNative = async (): Promise<void> => {
    if (isInitialized.value || !platformInfo.value.isNative) {
      return;
    }

    try {
      // Initialize splash screen
      const splashModule = await tryImportCapacitor<{ SplashScreen: { hide: () => Promise<void> } }>('splash-screen');
      if (splashModule?.SplashScreen) {
        await splashModule.SplashScreen.hide();
      }

      // Initialize status bar
      const statusBarModule = await tryImportCapacitor<{
        StatusBar: {
          setBackgroundColor: (opts: { color: string }) => Promise<void>;
          setStyle: (opts: { style: unknown }) => Promise<void>;
        };
        Style: { Light: unknown };
      }>('status-bar');

      if (statusBarModule?.StatusBar) {
        const { StatusBar, Style } = statusBarModule;
        // Set status bar style based on platform
        if (platformInfo.value.isAndroid) {
          await StatusBar.setBackgroundColor({ color: '#3b82f6' });
        }
        await StatusBar.setStyle({ style: Style.Light });
      }

      // Initialize keyboard plugin
      const keyboardModule = await tryImportCapacitor<{
        Keyboard: {
          addListener: (event: string, callback: () => void) => Promise<{ remove: () => Promise<void> }>;
        };
      }>('keyboard');

      if (keyboardModule?.Keyboard) {
        const { Keyboard } = keyboardModule;
        // Add keyboard listeners for better UX (store handles for cleanup)
        keyboardShowListener = await Keyboard.addListener('keyboardWillShow', () => {
          document.body.classList.add('keyboard-visible');
        });

        keyboardHideListener = await Keyboard.addListener('keyboardWillHide', () => {
          document.body.classList.remove('keyboard-visible');
        });
      }

      isInitialized.value = true;
    } catch (error) {
      console.warn('Failed to initialize Capacitor plugins:', error);
    }
  };

  /**
   * Trigger haptic feedback
   * Falls back gracefully on web (no-op)
   */
  const hapticFeedback = async (
    type: 'light' | 'medium' | 'heavy' | 'selection' = 'light'
  ): Promise<void> => {
    if (!platformInfo.value.isNative) {
      return;
    }

    const hapticsModule = await tryImportCapacitor<{
      Haptics: {
        impact: (opts: { style: unknown }) => Promise<void>;
        selectionStart: () => Promise<void>;
        selectionEnd: () => Promise<void>;
      };
      ImpactStyle: { Light: unknown; Medium: unknown; Heavy: unknown };
    }>('haptics');

    if (!hapticsModule?.Haptics) {
      return;
    }

    const { Haptics, ImpactStyle } = hapticsModule;

    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'selection':
        await Haptics.selectionStart();
        await Haptics.selectionEnd();
        break;
    }
  };

  /**
   * Show the splash screen
   * Useful for hiding app during data loading
   */
  const showSplash = async (): Promise<void> => {
    if (!platformInfo.value.isNative) {
      return;
    }

    const splashModule = await tryImportCapacitor<{
      SplashScreen: { show: (opts: { autoHide: boolean }) => Promise<void> };
    }>('splash-screen');

    if (splashModule?.SplashScreen) {
      await splashModule.SplashScreen.show({ autoHide: false });
    }
  };

  /**
   * Hide the splash screen
   */
  const hideSplash = async (): Promise<void> => {
    if (!platformInfo.value.isNative) {
      return;
    }

    const splashModule = await tryImportCapacitor<{
      SplashScreen: { hide: () => Promise<void> };
    }>('splash-screen');

    if (splashModule?.SplashScreen) {
      await splashModule.SplashScreen.hide();
    }
  };

  /**
   * Store a value securely using Capacitor Preferences
   * Falls back to localStorage on web
   */
  const setSecureValue = async (key: string, value: string): Promise<void> => {
    const prefsModule = await tryImportCapacitor<{
      Preferences: { set: (opts: { key: string; value: string }) => Promise<void> };
    }>('preferences');

    if (prefsModule?.Preferences) {
      await prefsModule.Preferences.set({ key, value });
    } else {
      // Fall back to localStorage
      localStorage.setItem(key, value);
    }
  };

  /**
   * Get a securely stored value
   * Falls back to localStorage on web
   */
  const getSecureValue = async (key: string): Promise<string | null> => {
    const prefsModule = await tryImportCapacitor<{
      Preferences: { get: (opts: { key: string }) => Promise<{ value: string | null }> };
    }>('preferences');

    if (prefsModule?.Preferences) {
      const result = await prefsModule.Preferences.get({ key });
      return result.value;
    } else {
      // Fall back to localStorage
      return localStorage.getItem(key);
    }
  };

  /**
   * Remove a securely stored value
   */
  const removeSecureValue = async (key: string): Promise<void> => {
    const prefsModule = await tryImportCapacitor<{
      Preferences: { remove: (opts: { key: string }) => Promise<void> };
    }>('preferences');

    if (prefsModule?.Preferences) {
      await prefsModule.Preferences.remove({ key });
    } else {
      // Fall back to localStorage
      localStorage.removeItem(key);
    }
  };

  /**
   * Cleanup keyboard listeners
   * Should be called when the app is unmounting or no longer needs listeners
   */
  const cleanup = async (): Promise<void> => {
    if (keyboardShowListener) {
      await keyboardShowListener.remove();
      keyboardShowListener = null;
    }
    if (keyboardHideListener) {
      await keyboardHideListener.remove();
      keyboardHideListener = null;
    }
  };

  return {
    // Reactive state
    isNative: computed(() => platformInfo.value.isNative),
    platform: computed(() => platformInfo.value.platform),
    isIOS: computed(() => platformInfo.value.isIOS),
    isAndroid: computed(() => platformInfo.value.isAndroid),
    isWeb: computed(() => platformInfo.value.isWeb),
    isInitialized: readonly(isInitialized),
    platformInfo: readonly(platformInfo),

    // Methods
    detectPlatform,
    initializeNative,
    hapticFeedback,
    showSplash,
    hideSplash,
    setSecureValue,
    getSecureValue,
    removeSecureValue,
    cleanup,
  };
}
