// https://nuxt.com/docs/api/configuration/nuxt-config

// Detect if running in Capacitor native environment
const isCapacitor = process.env.CAPACITOR_PLATFORM !== undefined;

export default defineNuxtConfig({
  compatibilityDate: '2025-01-14',
  devtools: { enabled: true },

  // Disable experimental app manifest to prevent #app-manifest resolution errors
  // This is a known issue with Nuxt 3.19+ that can cause 404 errors in dev mode
  experimental: {
    appManifest: false,
  },

  // Disable SSR for Capacitor builds (SPA mode required for native apps)
  // Set CAPACITOR_PLATFORM env var when building for mobile
  ssr: !isCapacitor,

  app: {
    head: {
      script: [
        {
          innerHTML: `
            (function() {
              try {
                var theme = localStorage.getItem('theme') || 'default';
                var validThemes = ['default', 'midnight'];
                if (!validThemes.includes(theme)) {
                  theme = 'default';
                }
                document.documentElement.setAttribute('data-theme', theme);
                var darkThemes = ['midnight'];
                if (darkThemes.includes(theme)) {
                  document.documentElement.classList.add('dark');
                }
                var bgColors = {
                  'default': '#f9fafb',
                  'midnight': '#0f172a'
                };
                document.documentElement.style.backgroundColor = bgColors[theme] || '#f9fafb';
              } catch (e) {}
            })();
          `,
          type: 'text/javascript',
        },
        {
          src: 'https://accounts.google.com/gsi/client',
          async: true,
          defer: true,
        },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
  ],

  pwa: {
    // Disable PWA service worker registration when running in Capacitor
    // Native apps handle caching and offline differently
    disable: isCapacitor,
    registerType: 'autoUpdate',
    manifest: {
      name: 'Lumowski Inventory',
      short_name: 'Lumowski',
      description: 'Inventory Management System',
      theme_color: '#3b82f6',
      background_color: '#ffffff',
      display: 'standalone',
      icons: [
        {
          src: '/icons/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
    },
    devOptions: {
      enabled: !isCapacitor,
      type: 'module',
      suppressWarnings: true,
    },
  },

  // Nitro preset for static site generation (used by Capacitor)
  // SPA mode automatically generates a 200.html fallback

  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,
    // Email configuration for receipt delivery (Nodemailer SMTP)
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT || '587',
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    emailFromAddress: process.env.EMAIL_FROM_ADDRESS || 'receipts@lumowski.app',
    public: {
      apiBase: '/api',
      googleClientId: process.env.GOOGLE_CLIENT_ID,
    },
  },

  nitro: {
    experimental: {
      websocket: true,
    },
  },

  routeRules: {
    // Socket.io WebSocket/polling requests should not be treated as routes
    '/_ws/**': { prerender: false },
    // Disable SSR for authenticated app pages (prevents hydration mismatch with auth state)
    '/': { ssr: false },
    '/inventory/**': { ssr: false },
    '/import': { ssr: false },
    '/settings/**': { ssr: false },
    '/business/**': { ssr: false },
    // Keep SSR for public auth pages (SEO benefit)
    '/login': { ssr: true },
    '/register': { ssr: true },
  },
})
