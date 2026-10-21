// The pre-apply hook of version 1.0.0 (funcd ADR-0214). Schema 1 needs no migration, so it only records its call under
// key last of table meta, where the API reports it.
import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';

import { applyMigrations } from '@funcd-dev/drizzle';
import type { HookInput, MigrationRecord } from '../records';

// The migrations drizzle-kit generated for this version, applied when the App's value sql gives the hook TODO_SQL=on
// and its binding app to todo-db (funcd ADR-0236).
const migrations: Record<string, string> = import.meta.glob(
  ['../../drizzle/1.0.0/*.sql', '../../drizzle/1.0.0/meta/_journal.json'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);

export interface FuncOutput {
  migrated: number;
}

export async function handle(ctx: FunctionContext, event: CloudEvent<HookInput>): Promise<FuncOutput> {
  if (!event.data) {
    throw new Error('a hook call carries its input');
  }
  if (process.env.TODO_SQL === 'on') {
    ctx.log('migrate', 'sql', await applyMigrations(ctx, migrations));
  }
  const record: MigrationRecord = { by: 'todo-migrate 1.0.0', ...event.data, migrated: 0 };
  await ctx.kv.put('meta', 'last', JSON.stringify(record));
  ctx.log('migrate', record.event, record.to, record.migrated);
  return { migrated: 0 };
}
