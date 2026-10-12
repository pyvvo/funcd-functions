// The SQL schema of version 1.0.0 of the todo App (funcd ADR-0236): drizzle-kit generates drizzle/1.0.0 from it.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  done: integer('done').notNull().default(0),
});
