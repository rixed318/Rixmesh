import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@rixed-devos/domain': path.resolve(__dirname, './packages/domain/src/index.ts'),
      '@rixed-devos/orchestrator': path.resolve(__dirname, './packages/orchestrator/src/index.ts'),
      '@rixed-devos/workspaces': path.resolve(__dirname, './packages/workspaces/src/index.ts'),
      '@rixed-devos/providers': path.resolve(__dirname, './packages/providers/src/index.ts'),
      '@rixed-devos/policy': path.resolve(__dirname, './packages/policy/src/index.ts'),
      '@rixed-devos/artifacts': path.resolve(__dirname, './packages/artifacts/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
