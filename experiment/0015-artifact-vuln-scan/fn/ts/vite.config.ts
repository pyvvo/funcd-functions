import { funcd } from '@funcd-dev/vite-plugin';
import { defineConfig } from 'vite';

import { moduleGraphSbom } from './sbom-plugin.ts';

// Bundles render into one self-contained .mjs beside its contract file (funcd ADR-0144, ADR-0247), and writes the
// prototype SBOM of the packages that bundle inlines into sbom/.
export default defineConfig({
  plugins: [
    funcd({
      functions: {
        render: 'src/render/main.ts',
      },
      outDir: '.',
    }),
    moduleGraphSbom('sbom'),
  ],
});
