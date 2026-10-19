// The pre-apply hook of version 1.1.0 (funcd ADR-0214). Schema 2 adds done, so it rewrites each todo that lacks it
// before the 1.1.0 API replaces 1.0.0, then records its call under key last of table meta. A repeated call finds
// nothing left to rewrite.
import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';

import { bundled, migrateSQL } from '../db/migrate';
import type { HookInput, MigrationRecord, TodoRecord } from '../records';

// The migrations drizzle-kit generated for this version, applied when the App's value sql gives the hook TODO_SQL=on
// and its binding app to todo-db (funcd ADR-0236).
const migrations = bundled(
  import.meta.glob(['../../drizzle/1.1.0/*.sql', '../../drizzle/1.1.0/meta/_journal.json'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  'drizzle/1.1.0',
);

export interface FuncOutput {
  migrated: number;
}

export async function handle(ctx: FunctionContext, event: CloudEvent<HookInput>): Promise<FuncOutput> {
  if (!event.data) {
    throw new Error('a hook call carries its input');
  }
  if (process.env.TODO_SQL === 'on') {
    ctx.log('migrate', 'sql', await migrateSQL(ctx, 'app', migrations));
  }
  let migrated = 0;
  for (const id of await ctx.kv.list('todos')) {
    const todo = await ctx.kv.getJSON<TodoRecord>('todos', id);
    if (todo && typeof todo.done !== 'boolean') {
      const next: TodoRecord = { title: todo.title, done: false };
      await ctx.kv.put('todos', id, JSON.stringify(next));
      migrated++;
    }
  }
  const record: MigrationRecord = { by: 'todo-migrate 1.1.0', ...event.data, migrated };
  await ctx.kv.put('meta', 'last', JSON.stringify(record));
  ctx.log('migrate', record.event, record.to, migrated);
  return { migrated };
}
