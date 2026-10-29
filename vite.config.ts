import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { defineConfig, Plugin } from 'vite';

// Ensure required PNG icons exist in /public even after a cold container snapshot restore
function ensurePublicIcons(rootDir: string) {
  try {
    const publicDir = path.resolve(rootDir, 'public');
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    const requiredPngs = [
      { file: 'favicon.png', w: 32, h: 32 },
      { file: 'apple-touch-icon.png', w: 180, h: 180 },
      { file: 'icon-192.png', w: 192, h: 192 },
      { file: 'icon-512.png', w: 512, h: 512 },
      { file: 'icon-maskable-512.png', w: 512, h: 512 },
      { file: 'og-image.png', w: 1200, h: 630 },
    ];

    const missing = requiredPngs.filter((item) => !fs.existsSync(path.join(publicDir, item.file)));
    if (missing.length === 0) return;

    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c >>> 0;
    }
    const crc32 = (buf: Buffer) => {
      let c = 0xffffffff;
      for (let i = 0; i < buf.length; i++) {
        c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
      }
      return (c ^ 0xffffffff) >>> 0;
    };
    const makeChunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      const t = Buffer.from(type, 'ascii');
      const crcBuf = Buffer.alloc(4);
      crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
      return Buffer.concat([len, t, data, crcBuf]);
    };

    for (const { file, w, h } of missing) {
      const stride = w * 4 + 1;
      const raw = Buffer.alloc(stride * h);
      const cx = Math.floor(w / 2);
      const cy = Math.floor(h / 2);
      const rCoin = Math.floor(Math.min(w, h) * 0.34);
      const rInner = Math.floor(rCoin * 0.78);

      for (let y = 0; y < h; y++) {
        const rowOff = y * stride;
        raw[rowOff] = 0;
        for (let x = 0; x < w; x++) {
          const p = rowOff + 1 + x * 4;
          const dx = x - cx;
          const dy = y - cy;
          const dist2 = dx * dx + dy * dy;
          if (dist2 <= rInner * rInner) {
            // Deep violet core (#1E133A) with gold/emerald H
            const inLeft = Math.abs(dx + Math.floor(rInner * 0.34)) < Math.max(2, Math.floor(rInner * 0.14)) && Math.abs(dy) < Math.floor(rInner * 0.52);
            const inRight = Math.abs(dx - Math.floor(rInner * 0.34)) < Math.max(2, Math.floor(rInner * 0.14)) && Math.abs(dy) < Math.floor(rInner * 0.52);
            const inBar = Math.abs(dx) <= Math.floor(rInner * 0.36) && Math.abs(dy) < Math.max(2, Math.floor(rInner * 0.13));
            if (inBar) {
              raw[p] = 255; raw[p + 1] = 200; raw[p + 2] = 61; raw[p + 3] = 255;
            } else if (inLeft || inRight) {
              raw[p] = 46; raw[p + 1] = 242; raw[p + 2] = 160; raw[p + 3] = 255;
            } else {
              raw[p] = 30; raw[p + 1] = 19; raw[p + 2] = 58; raw[p + 3] = 255;
            }
          } else if (dist2 <= rCoin * rCoin) {
            // Gold coin rim (#FFC83D)
            raw[p] = 255; raw[p + 1] = 200; raw[p + 2] = 61; raw[p + 3] = 255;
          } else {
            // Light rounded tile background (#FFFDF9)
            raw[p] = 255; raw[p + 1] = 253; raw[p + 2] = 249; raw[p + 3] = 255;
          }
        }
      }

      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(w, 0);
      ihdr.writeUInt32BE(h, 4);
      ihdr[8] = 8;
      ihdr[9] = 6;
      const idat = zlib.deflateSync(raw, { level: 6 });
      const png = Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        makeChunk('IHDR', ihdr),
        makeChunk('IDAT', idat),
        makeChunk('IEND', Buffer.alloc(0)),
      ]);
      fs.writeFileSync(path.join(publicDir, file), png);
    }
  } catch (_) {}
}

// Fallback virtual module plugin in case vite-plugin-pwa is not loaded
function fallbackPwaVirtualPlugin(): Plugin {
  const virtualId = 'virtual:pwa-register/react';
  const resolvedId = '\0' + virtualId;
  return {
    name: 'fallback-pwa-virtual',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
      return null;
    },
    load(id) {
      if (id === resolvedId) {
        return `
import { useState, useEffect } from 'react';
export function useRegisterSW() {
  const needRefresh = useState(false);
  const offlineReady = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: () => window.location.reload(),
  };
}
`;
      }
      return null;
    },
  };
}

export default defineConfig(async () => {
  ensurePublicIcons(import.meta.dirname);

  let pwaPlugins: any[] = [];
  try {
    const { VitePWA } = await import('vite-plugin-pwa');
    pwaPlugins = VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'icon.svg',
        'favicon.png',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
        'og-image.png',
      ],
      manifest: {
        id: '/',
        name: 'Hisaab — Shared Expense & Khata Tracker',
        short_name: 'Hisaab',
        description: 'Shared expense tracker, smart group debt simplifier, and friend khata ledger.',
        theme_color: '#0B0714',
        background_color: '#0B0714',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    });
  } catch {
    pwaPlugins = [fallbackPwaVirtualPlugin()];
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(Array.isArray(pwaPlugins) ? pwaPlugins : [pwaPlugins]),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client'],
    },
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase') || id.includes('@firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg') || id.includes('pako') || id.includes('fflate')) {
                return 'vendor-pdf';
              }
              if (id.includes('motion') || id.includes('framer-motion')) {
                return 'vendor-motion';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('react-dom') || id.includes('react/')) {
                return 'vendor-react';
              }
            }
            return undefined;
          },
        },
      },
    },
    server: {
      hmr: false,
      ws: false,
      watch: null,
    },
  };
});
