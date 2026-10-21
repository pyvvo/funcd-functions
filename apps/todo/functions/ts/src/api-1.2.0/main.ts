// The todo API, version 1.2.0. The todos and their upload records live in SQLDatabase todo-db (funcd ADR-0233),
// queried with Drizzle over context.sql, where the 1.2.0 migrate hook copied them from KV; done is a new operation,
// and list can keep only the done or the open todos. KV keeps what is read by key: the migration record (meta), the
// release record (warm) and the todos the change feed reported (added, funcd ADR-0235).
import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';
import { and, asc, count, eq, isNotNull } from 'drizzle-orm';

import { funcdDrizzle } from '@funcd-dev/drizzle';
import { todos, uploads } from '../db/schema-1.2.0';
import type { MigrationRecord, ReleaseRecord } from '../records';
import { hang, putUpload, requireToken, type Upload } from '../shared';

const version = '1.2.0';

export interface FuncInput {
  op: 'add' | 'list' | 'get' | 'done' | 'attach' | 'hang';
  title?: string;
  id?: string;
  name?: string;
  content?: string;
  token?: string;
  /** list keeps only the todos whose done is this. */
  done?: boolean;
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
  counts?: { open: number; done: number };
  attachment?: string | null;
  uploads?: Upload[];
  migration?: MigrationRecord | null;
  release?: ReleaseRecord | null;
  notified?: string[];
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
    case 'done':
      return markDone(ctx, input);
    case 'attach':
      await requireToken(ctx, 'attach', input.token);
      await mustExist(ctx, 'attach', input.id ?? '');
      await putUpload(ctx, input.id ?? '', input.name ?? '', input.content ?? '');
      return { version, id: input.id };
    case 'hang':
      await requireToken(ctx, 'hang', input.token);
      return hang();
    default:
      return list(ctx, input.done);
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
  await requireToken(ctx, 'add', input.token);
  const title = input.title ?? '';
  const id = slug(title);
  if (id === '') {
    throw new Error('add needs a title');
  }
  await funcdDrizzle(ctx)
    .insert(todos)
    .values({ slug: id, title, done: 0 })
    .onConflictDoUpdate({ target: todos.slug, set: { title, done: 0 } });
  await ctx.blob.put('files', `${id}.txt`, utf8.encode(title));
  await ctx.blob.put('copies', `${id}.json`, utf8.encode(JSON.stringify({ title, done: false })));
  ctx.log('add', id);
  return { version, id };
}

async function markDone(ctx: FunctionContext, input: FuncInput): Promise<FuncOutput> {
  await requireToken(ctx, 'done', input.token);
  const id = input.id ?? '';
  const updated = await funcdDrizzle(ctx)
    .update(todos)
    .set({ done: 1 })
    .where(eq(todos.slug, id))
    .returning({ slug: todos.slug });
  if (updated.length === 0) {
    throw new Error(`done needs an existing todo, not "${id}"`);
  }
  ctx.log('done', id);
  return { version, id };
}

async function mustExist(ctx: FunctionContext, op: string, id: string): Promise<void> {
  const found = await funcdDrizzle(ctx).select({ id: todos.id }).from(todos).where(eq(todos.slug, id));
  if (found.length === 0) {
    throw new Error(`${op} needs an existing todo, not "${id}"`);
  }
}

// get reads the todo with its uploads in one join, and its attachment from the bucket.
async function get(ctx: FunctionContext, id: string): Promise<FuncOutput> {
  const rows = await funcdDrizzle(ctx)
    .select({ title: todos.title, done: todos.done, name: uploads.name, size: uploads.size })
    .from(todos)
    .leftJoin(uploads, eq(uploads.todoId, todos.id))
    .where(eq(todos.slug, id))
    .orderBy(asc(uploads.name));
  const file = await ctx.blob.get('files', `${id}.txt`);
  return {
    version,
    todos: rows.length > 0 ? [{ id, title: rows[0].title, done: rows[0].done === 1 }] : [],
    attachment: file ? new TextDecoder().decode(file) : null,
    uploads: rows.flatMap((r) => (r.name === null || r.size === null ? [] : [{ name: r.name, size: r.size }])),
  };
}

async function list(ctx: FunctionContext, done: boolean | undefined): Promise<FuncOutput> {
  const db = funcdDrizzle(ctx);
  const keep = done === undefined ? isNotNull(todos.slug) : and(isNotNull(todos.slug), eq(todos.done, done ? 1 : 0));
  const rows = await db
    .select({ slug: todos.slug, title: todos.title, done: todos.done })
    .from(todos)
    .where(keep)
    .orderBy(asc(todos.slug));
  const counts = { open: 0, done: 0 };
  for (const c of await db
    .select({ done: todos.done, n: count() })
    .from(todos)
    .where(isNotNull(todos.slug))
    .groupBy(todos.done)) {
    counts[c.done === 1 ? 'done' : 'open'] = c.n;
  }
  return {
    version,
    todos: rows.map((r) => ({ id: r.slug ?? '', title: r.title, done: r.done === 1 })),
    counts,
    migration: await ctx.kv.getJSON<MigrationRecord>('meta', 'last'),
    release: await ctx.kv.getJSON<ReleaseRecord>('warm', 'last'),
    notified: (await ctx.kv.list('added')).sort(),
    greeting: process.env.TODO_GREETING ?? '',
    tokenSet: Boolean(await ctx.secret.get('TODO_API_TOKEN')),
  };
}
