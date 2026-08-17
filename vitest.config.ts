import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  resolve: {
    alias: {
      '@rin/types': fileURLToPath(new URL('./packages/types/src/index.ts', import.meta.url)),
      '@rin/event-bus': fileURLToPath(
        new URL('./packages/event-bus/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
});
