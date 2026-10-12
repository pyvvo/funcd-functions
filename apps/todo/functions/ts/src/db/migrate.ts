// The SQL step of the migrate hook (funcd ADR-0236 Decision 5): Drizzle's sqlite-proxy migrator applies the
// migrations a version ships that table _migrations lacks, with their _migrations rows, in one context.sql execute,
// so a failed migration records nothing. The migrator reads its folder from disk, so the bundled files are written
// to a temporary directory first.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import type { FunctionContext } from '@funcd-dev/shim';
import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';

import { proxyDB } from './proxy';

const table = '_migrations';

/** files maps each path of a drizzle-kit output folder to its content; it returns how many migrations it applied. */
export async function migrateSQL(ctx: FunctionContext, alias: string, files: Record<string, string>): Promise<number> {
  const dir = mkdtempSync(join(tmpdir(), 'drizzle-'));
  try {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    let applied = 0;
    await migrate(
      proxyDB(ctx, alias),
      async (queries) => {
        if (queries.length === 0) return;
        await ctx.sql.execute(alias, queries);
        applied = queries.filter((q) => q.startsWith(`INSERT INTO \`${table}\``)).length;
      },
      { migrationsFolder: dir, migrationsTable: table },
    );
    return applied;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** bundled turns an import.meta.glob of a drizzle-kit folder into its paths relative to that folder. */
export function bundled(glob: Record<string, string>, folder: string): Record<string, string> {
  return Object.fromEntries(Object.entries(glob).map(([path, text]) => [path.slice(path.indexOf(folder) + folder.length + 1), text]));
}
