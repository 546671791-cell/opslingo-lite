import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

const deployTarget = process.env.VITE_DEPLOY_TARGET;
const appBase = deployTarget === 'pages' ? '/opslingo-lite/' : './';

export default defineConfig({
  base: appBase,
  plugins: [
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'OpsLingo Lite · 离线英语',
        short_name: 'OpsLingo',
        description: '覆盖日常交流、美国生活、职场与进阶学习的离线英语训练工具',
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
        globIgnores: ['vocabulary/packs/offline-*.json'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/audio\/vocabulary\/.*\.m4a$/,
            handler: 'CacheFirst',
            options: { cacheName: 'opslite-offline-audio-v1', expiration: { maxEntries: 3200 } }
          },
          {
            urlPattern: /\/vocabulary\/packs\/offline-.*\.json/,
            handler: 'CacheFirst',
            options: { cacheName: 'offline-vocabulary-packs', expiration: { maxEntries: 8 } }
          },
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
