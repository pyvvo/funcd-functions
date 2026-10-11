// The pre-apply hook of version 1.0.0 (funcd ADR-0214). Schema 1 needs no migration, so it only records its call under
// key last of table meta, where the API reports it.
import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';

import type { HookInput, MigrationRecord } from './records';

export interface FuncOutput {
  migrated: number;
}

export async function handle(ctx: FunctionContext, event: CloudEvent<HookInput>): Promise<FuncOutput> {
  if (!event.data) {
    throw new Error('a hook call carries its input');
  }
  const record: MigrationRecord = { by: 'todo-migrate 1.0.0', ...event.data, migrated: 0 };
  await ctx.kv.put('meta', 'last', JSON.stringify(record));
  ctx.log('migrate', record.event, record.to, record.migrated);
  return { migrated: 0 };
}
