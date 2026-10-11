// The pre-apply hook of version 1.1.0 (funcd ADR-0214). Schema 2 adds done, so it rewrites each todo that lacks it
// before the 1.1.0 API replaces 1.0.0, then records its call under key last of table meta. A repeated call finds
// nothing left to rewrite.
import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';

import type { HookInput, MigrationRecord, TodoRecord } from './records';

export interface FuncOutput {
  migrated: number;
}

export async function handle(ctx: FunctionContext, event: CloudEvent<HookInput>): Promise<FuncOutput> {
  if (!event.data) {
    throw new Error('a hook call carries its input');
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
