import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  test: { globals: true, environment: 'jsdom', include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'] },
});
