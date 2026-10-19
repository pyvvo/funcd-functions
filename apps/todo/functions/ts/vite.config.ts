import { funcd } from '@funcd-dev/vite-plugin';
import { defineConfig } from 'vite';

// Bundles each function into one self-contained .mjs beside its <name>.contract.yaml (funcd ADR-0144, ADR-0247).
export default defineConfig({
  plugins: [
    funcd({
      functions: {
        'api-1.0.0': 'src/api-1.0.0/main.ts',
        'api-1.1.0': 'src/api-1.1.0/main.ts',
        'api-1.2.0': 'src/api-1.2.0/main.ts',
        'migrate-1.0.0': 'src/migrate-1.0.0/main.ts',
        'migrate-1.1.0': 'src/migrate-1.1.0/main.ts',
        'migrate-1.2.0': 'src/migrate-1.2.0/main.ts',
        collect: 'src/collect/main.ts',
        notes: 'src/notes/main.ts',
      },
      outDir: '.',
    }),
  ],
});
