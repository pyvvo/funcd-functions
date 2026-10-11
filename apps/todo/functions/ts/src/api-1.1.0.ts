// The todo API, version 1.1.0. A todo is a schema-2 record of table todos, which adds done; list returns only schema-2
// todos and counts the others as unmigrated, so a todo of 1.0.0 shows only once the 1.1.0 migrate hook rewrote it.
import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';

import type { MigrationRecord, ReleaseRecord, TodoRecord } from './records';

const version = '1.1.0';

export interface FuncInput {
  op: 'add' | 'list' | 'get';
  title?: string;
  id?: string;
  token?: string;
}

export interface Todo {
  id: string;
  title: string;
  done: boolean;
}

export interface FuncOutput {
  version: string;
  id?: string;
  todos?: Todo[];
  unmigrated?: number;
  attachment?: string | null;
  migration?: MigrationRecord | null;
  release?: ReleaseRecord | null;
  greeting?: string;
  tokenSet?: boolean;
}

const utf8 = new TextEncoder();

export async function handle(ctx: FunctionContext, event: CloudEvent<FuncInput>): Promise<FuncOutput> {
  const input = event.data ?? { op: 'list' };
  switch (input.op) {
    case 'add':
      return add(ctx, input);
    case 'get':
      return get(ctx, input.id ?? '');
    default:
      return list(ctx);
  }
}

// A todo's id is its title in lower case, with each run of other characters replaced by a dash.
function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function add(ctx: FunctionContext, input: FuncInput): Promise<FuncOutput> {
  const token = process.env.TODO_API_TOKEN;
  if (!token || input.token !== token) {
    throw new Error('add needs the API token');
  }
  const title = input.title ?? '';
  const id = slug(title);
  if (id === '') {
    throw new Error('add needs a title');
  }
  const record: TodoRecord = { title, done: false };
  await ctx.kv.put('todos', id, JSON.stringify(record));
  await ctx.blob.put('files', `${id}.txt`, utf8.encode(title));
  await ctx.blob.put('uploads', `${id}.json`, utf8.encode(JSON.stringify(record)));
  ctx.log('add', id);
  return { version, id };
}

async function get(ctx: FunctionContext, id: string): Promise<FuncOutput> {
  const record = await ctx.kv.getJSON<TodoRecord>('todos', id);
  const file = await ctx.blob.get('files', `${id}.txt`);
  return {
    version,
    todos: record ? [{ id, title: record.title, done: record.done === true }] : [],
    attachment: file ? new TextDecoder().decode(file) : null,
  };
}

async function list(ctx: FunctionContext): Promise<FuncOutput> {
  const todos: Todo[] = [];
  let unmigrated = 0;
  for (const id of (await ctx.kv.list('todos')).sort()) {
    const record = await ctx.kv.getJSON<TodoRecord>('todos', id);
    if (!record) {
      continue;
    }
    if (typeof record.done === 'boolean') {
      todos.push({ id, title: record.title, done: record.done });
    } else {
      unmigrated++;
    }
  }
  return {
    version,
    todos,
    unmigrated,
    migration: await ctx.kv.getJSON<MigrationRecord>('meta', 'last'),
    release: await ctx.kv.getJSON<ReleaseRecord>('warm', 'last'),
    greeting: process.env.TODO_GREETING ?? '',
    tokenSet: Boolean(process.env.TODO_API_TOKEN),
  };
}
