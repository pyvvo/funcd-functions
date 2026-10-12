import { funcd } from '@funcd-dev/vite-plugin';
import { defineConfig } from 'vite';

// Bundles each function into one self-contained .mjs beside its <name>.funcdctl.yaml (funcd ADR-0144).
export default defineConfig({
  plugins: [
    funcd({
      functions: {
        'api-1.0.0': 'src/api-1.0.0.ts',
        'api-1.1.0': 'src/api-1.1.0.ts',
        'migrate-1.0.0': 'src/migrate-1.0.0.ts',
        'migrate-1.1.0': 'src/migrate-1.1.0.ts',
        collect: 'src/collect.ts',
        notes: 'src/notes.ts',
      },
      outDir: '.',
    }),
  ],
});
