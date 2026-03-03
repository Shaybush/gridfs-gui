import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

const rootDir = path.join(__dirname, '../');

export default defineConfig(({ mode }) => ({
  root: `${process.cwd()}/src`,
  plugins: [
    react(),
    tailwindcss(),
    svgr({
      include: '**/*.svg',
      svgrOptions: { exportType: 'named' },
    }),
  ],
  publicDir: './public',
  server: {
    open: true,
    port: 3004,
    strictPort: false,
    origin: 'http://localhost:3000',
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, 'src'),
    },
  },
  envDir: rootDir,
  clearScreen: false,
  logLevel: 'info',
  cacheDir: '../node_modules/.cache/vite',
  build: {
    outDir: '../dist',
    sourcemap: true,
    minify: 'esbuild',
    target: 'esnext',
    manifest: true,
    emptyOutDir: true,
    chunkSizeWarningLimit: 500,
    watch: null,
    assetsDir: 'main',
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    cssMinify: 'esbuild',
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name].[hash].js',
        chunkFileNames: 'js/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || '';

          if (/\.css$/i.test(info)) {
            return 'css/[name].[hash][extname]';
          }

          if (/\.(png|jpe?g|gif|svg|webp|avif|ico|bmp|tiff?)$/i.test(info)) {
            return 'images/[name].[hash][extname]';
          }

          if (/\.(woff2?|eot|ttf|otf)$/i.test(info)) {
            return 'fonts/[name].[hash][extname]';
          }

          return 'assets/[name].[hash][extname]';
        },
      },
    },
  },
  preview: { port: 3000, strictPort: true, open: false },
  css: {
    modules: {
      generateScopedName: mode === 'development' ? '[name].[local].[hash:base64:3]' : '[hash:base64:7]',
      localsConvention: 'camelCase',
      scopeBehaviour: 'local',
    },
    preprocessorOptions: {
      scss: {
        loadPaths: [path.resolve(__dirname)],
      },
    },
    devSourcemap: true,
    transformer: 'postcss',
  },
}));
