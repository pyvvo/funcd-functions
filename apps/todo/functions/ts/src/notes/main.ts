// The notes Function: a TypeScript owner of SQLDatabase notes-db (funcd ADR-0233). Its schema is Drizzle code, sent
// through context.sql by the sqlite-proxy driver (db/proxy).
import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { proxyDB } from '../db/proxy';

export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  done: integer('done').notNull().default(0),
});

export interface FuncInput {
  op: 'init' | 'add' | 'list' | 'batch' | 'fill' | 'size';
  title?: string;
  titles?: (string | null)[];
  megabytes?: number;
}

export interface FuncOutput {
  notes?: { id: number; title: string; done: number }[];
  added?: { id: number; title: string };
  error?: string;
  blobs?: number;
  bytes?: number;
}

export async function handle(ctx: FunctionContext, event: CloudEvent<FuncInput>): Promise<FuncOutput> {
  const d = proxyDB(ctx, 'app');
  const input = event.data ?? { op: 'list' };
  switch (input.op) {
    case 'init':
      await d.run(
        sql`CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)`,
      );
      return {};
    case 'add': {
      const [added] = await d
        .insert(notes)
        .values({ title: input.title ?? '' })
        .returning({ id: notes.id, title: notes.title });
      return { added };
    }
    case 'batch':
      try {
        await d.batch(
          (input.titles ?? []).map((title) => d.insert(notes).values({ title: title as string })) as [never, ...never[]],
        );
      } catch (err) {
        return { error: (err as Error).message };
      }
      return {};
    // fill grows the database by megabytes of 1 MiB rows, generated in the engine, for funcd's backup lane steps.
    case 'fill':
      await ctx.sql.execute('app', [
        'CREATE TABLE IF NOT EXISTS blobs (v BLOB NOT NULL)',
        [
          'WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < ?) INSERT INTO blobs (v) SELECT zeroblob(1048576) FROM c',
          [input.megabytes ?? 1],
        ],
      ]);
      return {};
    case 'size': {
      const { values } = await ctx.sql.queryValues('app', 'SELECT count(*), coalesce(sum(length(v)), 0) FROM blobs');
      const [blobs, bytes] = values[0] as [number, number];
      return { blobs, bytes };
    }
    default:
      return { notes: await d.select().from(notes).orderBy(notes.id) };
  }
}
