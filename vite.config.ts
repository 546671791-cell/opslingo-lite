import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

const repoBase = process.env.GITHUB_ACTIONS ? '/opslingo-lite/' : '/';

export default defineConfig({
  base: repoBase,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: '航旅英语 · OpsLingo Lite',
        short_name: '航旅英语',
        description: '离线航旅商务英语训练工具',
        lang: 'zh-CN',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        theme_color: '#1769e0',
        background_color: '#f4f6fa',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/content\/(?:packs\/.*\.json)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'content-packs', expiration: { maxEntries: 12 } }
          },
          {
            urlPattern: /\/content\/catalog\.json/,
            handler: 'NetworkFirst',
            options: { cacheName: 'content-catalog', networkTimeoutSeconds: 4 }
          }
        ]
      }
    })
  ]
});
