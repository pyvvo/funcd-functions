// The todo API, version 1.0.0. A todo is a schema-1 record of table todos; add also stores its title as an attachment,
// which the App keeps when it is deleted, and a copy of the record, which goes with the App. attach uploads a file of a
// todo, which the intake Function records and get lists; hang blocks the API for funcd's liveness check.
import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';

import type { MigrationRecord, ReleaseRecord, TodoRecord } from './records';
import { attach, hang, requireToken, type Upload, uploadsOf } from './shared';

const version = '1.0.0';

export interface FuncInput {
  op: 'add' | 'list' | 'get' | 'attach' | 'hang';
  title?: string;
  id?: string;
  name?: string;
  content?: string;
  token?: string;
}

export interface Todo {
  id: string;
  title: string;
}

export interface FuncOutput {
  version: string;
  id?: string;
  todos?: Todo[];
  attachment?: string | null;
  uploads?: Upload[];
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
    case 'attach':
      requireToken('attach', input.token);
      await attach(ctx, input.id ?? '', input.name ?? '', input.content ?? '');
      return { version, id: input.id };
    case 'hang':
      requireToken('hang', input.token);
      return hang();
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
  requireToken('add', input.token);
  const title = input.title ?? '';
  const id = slug(title);
  if (id === '') {
    throw new Error('add needs a title');
  }
  const record: TodoRecord = { title };
  await ctx.kv.put('todos', id, JSON.stringify(record));
  await ctx.blob.put('files', `${id}.txt`, utf8.encode(title));
  await ctx.blob.put('copies', `${id}.json`, utf8.encode(JSON.stringify(record)));
  ctx.log('add', id);
  return { version, id };
}

async function get(ctx: FunctionContext, id: string): Promise<FuncOutput> {
  const record = await ctx.kv.getJSON<TodoRecord>('todos', id);
  const file = await ctx.blob.get('files', `${id}.txt`);
  return {
    version,
    todos: record ? [{ id, title: record.title }] : [],
    attachment: file ? new TextDecoder().decode(file) : null,
    uploads: await uploadsOf(ctx, id),
  };
}

async function list(ctx: FunctionContext): Promise<FuncOutput> {
  const todos: Todo[] = [];
  for (const id of (await ctx.kv.list('todos')).sort()) {
    const record = await ctx.kv.getJSON<TodoRecord>('todos', id);
    if (record) {
      todos.push({ id, title: record.title });
    }
  }
  return {
    version,
    todos,
    migration: await ctx.kv.getJSON<MigrationRecord>('meta', 'last'),
    release: await ctx.kv.getJSON<ReleaseRecord>('warm', 'last'),
    greeting: process.env.TODO_GREETING ?? '',
    tokenSet: Boolean(process.env.TODO_API_TOKEN),
  };
}
