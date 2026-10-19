// The pre-apply hook of version 1.2.0 (funcd ADR-0214, ADR-0236). It applies the SQL migrations up to 1.2.0, then
// copies each todo and upload record of KV into todo-db before the 1.2.0 API, which reads only SQL, replaces the one
// before. A row is inserted only when absent, so a repeated call copies only what is new; the KV records stay, so the
// 1.1.0 API still runs on them (expand, then contract). It records its call under key last of table meta.
import type { CloudEvent, FunctionContext, SQLStatement } from '@funcd-dev/shim';

import { bundled, migrateSQL } from '../db/migrate';
import type { HookInput, MigrationRecord, TodoRecord, UploadRecord } from '../records';

const migrations = bundled(
  import.meta.glob(['../../drizzle/1.2.0/*.sql', '../../drizzle/1.2.0/meta/_journal.json'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  'drizzle/1.2.0',
);

// The local API takes at most 500 statements per call (funcd ADR-0233).
const batch = 400;

const insertTodo = 'INSERT INTO todos (slug, title, done) VALUES (?, ?, ?) ON CONFLICT (slug) DO NOTHING';
const insertUpload =
  'INSERT INTO uploads (todo_id, name, size, object_version, recorded_by) SELECT id, ?, ?, ?, ? FROM todos ' +
  'WHERE slug = ? ON CONFLICT (todo_id, name) DO NOTHING';

export interface FuncOutput {
  migrated: number;
  uploads: number;
}

export async function handle(ctx: FunctionContext, event: CloudEvent<HookInput>): Promise<FuncOutput> {
  if (!event.data) {
    throw new Error('a hook call carries its input');
  }
  const applied = await migrateSQL(ctx, 'app', migrations);
  const todos: SQLStatement[] = [];
  for (const id of await ctx.kv.list('todos')) {
    const todo = await ctx.kv.getJSON<TodoRecord>('todos', id);
    if (todo) {
      todos.push([insertTodo, [id, todo.title, todo.done === true ? 1 : 0]]);
    }
  }
  const uploads: SQLStatement[] = [];
  for (const key of await ctx.kv.list('uploads')) {
    const upload = await ctx.kv.getJSON<UploadRecord>('uploads', key);
    const slash = key.indexOf('/');
    if (upload && slash > 0) {
      uploads.push([insertUpload, [key.slice(slash + 1), upload.size, upload.version, upload.by, key.slice(0, slash)]]);
    }
  }
  const migrated = await copy(ctx, todos);
  const copied = await copy(ctx, uploads);
  const record: MigrationRecord = { by: 'todo-migrate 1.2.0', ...event.data, migrated };
  await ctx.kv.put('meta', 'last', JSON.stringify(record));
  ctx.log('migrate', record.event, record.to, applied, migrated, copied);
  return { migrated, uploads: copied };
}

// copy runs the statements in calls of at most batch, each all or nothing, and returns the rows they inserted.
async function copy(ctx: FunctionContext, statements: SQLStatement[]): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < statements.length; i += batch) {
    for (const r of await ctx.sql.execute('app', statements.slice(i, i + batch))) {
      inserted += r.rowsAffected;
    }
  }
  return inserted;
}
