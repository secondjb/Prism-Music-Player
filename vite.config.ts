import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function revolistStencilPlugin(): Plugin {
  return {
    name: "revolist-stencil-plugin",
    enforce: "pre",
    transform(code, id) {
      if (id.includes("@revolist") || id.includes("revogrid")) {
        let modified = code;
        if (modified.includes("var isHost = (node) => node && node.$tag$ === Host;")) {
          modified = modified.replace(
            /var isHost = \(node\) => node && node\.\$tag\$ === Host;/g,
            'var isHost = (node) => Boolean(node && (node.$tag$ === Host || (typeof node.$tag$ === "object" && node.$tag$ !== null) || ((node.$flags$ & 4) !== 0)));'
          );
        }
        if (modified.includes('? "slot-fb" : newVNode2.$tag$')) {
          modified = modified.replace(
            /\? "slot-fb" : newVNode2\.\$tag\$/g,
            '? "slot-fb" : (typeof newVNode2.$tag$ === "string" && newVNode2.$tag$ ? newVNode2.$tag$ : "div")'
          );
        }
        if (modified.includes('const elm = newVnode.$elm$.nodeType') && !modified.includes('if (!newVnode || !newVnode.$elm$) return;')) {
          modified = modified.replace(
            /const elm = newVnode\.\$elm\$\.nodeType === 11/g,
            'if (!newVnode || !newVnode.$elm$) return;\n  const elm = newVnode.$elm$.nodeType === 11'
          );
        }
        return modified !== code ? { code: modified, map: null } : null;
      }
    },
  };
}

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  base: "./",
  plugins: [react(), tailwindcss(), revolistStencilPlugin()],

  optimizeDeps: {
    include: [
      "@revolist/react-datagrid",
      "@revolist/revogrid",
      "@revolist/revogrid/loader",
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || '127.0.0.1',
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    // Modern target for Tauri WebView2 (Windows 10/11)
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Don't minify in debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@mui') || id.includes('@emotion')) {
              return 'vendor-mui';
            }
            if (id.includes('@revolist')) {
              return 'vendor-grid';
            }
            if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
              return 'vendor-charts';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (
              id.includes('kuroshiro') ||
              id.includes('pinyin-pro') ||
              id.includes('lyric-romanizer') ||
              id.includes('@romanize')
            ) {
              return 'vendor-romanize';
            }
            if (id.includes('@tauri-apps')) {
              return 'vendor-tauri';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
          }
        },
      },
    },
  },
}));
