// The prototype experiment 0015 tests: a CycloneDX SBOM of exactly the npm packages Rolldown inlined into each
// function's bundle, read from the chunk's module graph instead of the lockfile. A lockfile also names what the
// handler never imports.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { Plugin } from 'vite';

interface Component {
  type: 'library';
  'bom-ref': string;
  name: string;
  version: string;
  purl: string;
}

const marker = '/node_modules/';

// packageRoot is the directory of the npm package a module belongs to, or undefined for the project's own code.
function packageRoot(id: string): string | undefined {
  const path = id.split('?')[0];
  const at = path.lastIndexOf(marker);
  if (path.startsWith('\0') || at < 0) {
    return undefined;
  }
  const rest = path.slice(at + marker.length).split('/');
  const segments = rest[0].startsWith('@') ? 2 : 1;
  return path.slice(0, at + marker.length) + rest.slice(0, segments).join('/');
}

function purl(name: string, version: string): string {
  return `pkg:npm/${name.replace(/^@/, '%40')}@${version}`;
}

// actions/attest signs a CycloneDX SBOM only when it carries a serialNumber. One derived from the SBOM's content
// keeps the SBOM reproducible.
function serialNumber(seed: string): string {
  const h = createHash('sha256').update(seed).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `urn:uuid:${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

export function moduleGraphSbom(dir: string): Plugin {
  return {
    name: 'exp-0015-module-graph-sbom',
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || !chunk.isEntry) {
          continue;
        }
        const components = new Map<string, Component>();
        for (const id of chunk.moduleIds) {
          // A module tree-shaken to nothing ships no code, so its package is not in the bundle.
          if (chunk.modules?.[id]?.renderedLength === 0) {
            continue;
          }
          const root = packageRoot(id);
          if (root === undefined) {
            continue;
          }
          const { name, version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
          const ref = purl(name, version);
          components.set(ref, { type: 'library', 'bom-ref': ref, name, version, purl: ref });
        }
        const sorted = [...components.values()].sort((a, b) => a.purl.localeCompare(b.purl));
        const bom = {
          bomFormat: 'CycloneDX',
          specVersion: '1.5',
          serialNumber: serialNumber(chunk.name + sorted.map((c) => c.purl).join('\n')),
          version: 1,
          metadata: {
            component: { type: 'application', 'bom-ref': chunk.name, name: chunk.name },
          },
          components: sorted,
          dependencies: [{ ref: chunk.name, dependsOn: sorted.map((c) => c['bom-ref']) }],
        };
        mkdirSync(resolve(dir), { recursive: true });
        writeFileSync(join(resolve(dir), `${chunk.name}.cdx.json`), JSON.stringify(bom, null, 2) + '\n');
      }
    },
  };
}
