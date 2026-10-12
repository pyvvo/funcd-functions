// The SQL schema of version 1.1.0: it adds note to todos, so the 1.0.0 API still runs on it (expand, then contract).
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  done: integer('done').notNull().default(0),
  note: text('note'),
});
