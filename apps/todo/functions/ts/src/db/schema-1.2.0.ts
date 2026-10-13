// The SQL schema of version 1.2.0, where todo-db holds the App's todos and upload records: slug is a todo's id in the
// API, the one the KV records were keyed by, and an upload belongs to its todo. Only additions, so 1.1.0 still runs.
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  done: integer('done').notNull().default(0),
  note: text('note'),
  slug: text('slug').unique(),
});

export const uploads = sqliteTable(
  'uploads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    todoId: integer('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    size: integer('size').notNull(),
    objectVersion: text('object_version').notNull(),
    recordedBy: text('recorded_by').notNull(),
  },
  (t) => [unique('uploads_todo_name').on(t.todoId, t.name)],
);
