import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    testTimeout: 30000, // 30 seconds default timeout
    hookTimeout: 30000, // 30 seconds for hooks
  },
});


