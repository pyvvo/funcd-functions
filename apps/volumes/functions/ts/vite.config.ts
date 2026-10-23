import { funcd } from '@funcd-dev/vite-plugin';
import { defineConfig } from 'vite';

// Bundles the function into one self-contained .mjs beside its files.contract.yaml (funcd ADR-0144, ADR-0247).
export default defineConfig({
  plugins: [
    funcd({
      functions: {
        files: 'src/files/main.ts',
      },
      outDir: '.',
    }),
  ],
});
