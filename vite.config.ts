import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:artifact` produces one self-contained HTML file (dist-artifact/index.html)
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
    base: artifact ? './' : '/',
    plugins: [react(), ...(artifact ? [viteSingleFile()] : [])],
    build: { chunkSizeWarningLimit: 900, outDir: artifact ? 'dist-artifact' : 'dist' },
  };
});
