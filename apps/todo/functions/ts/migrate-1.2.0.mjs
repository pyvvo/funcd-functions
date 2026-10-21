import { createRequire as __funcdCreateRequire } from "node:module";
__funcdCreateRequire(import.meta.url);
import { createHash } from "node:crypto";
//#region drizzle/1.2.0/0000_todos.sql?raw
var _0000_todos_default = "CREATE TABLE `todos` (\n	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n	`title` text NOT NULL,\n	`done` integer DEFAULT 0 NOT NULL\n);\n";
//#endregion
//#region drizzle/1.2.0/0001_todo_note.sql?raw
var _0001_todo_note_default = "ALTER TABLE `todos` ADD `note` text;";
//#endregion
//#region drizzle/1.2.0/0002_todo_slug_uploads.sql?raw
var _0002_todo_slug_uploads_default = "CREATE TABLE `uploads` (\n	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n	`todo_id` integer NOT NULL,\n	`name` text NOT NULL,\n	`size` integer NOT NULL,\n	`object_version` text NOT NULL,\n	`recorded_by` text NOT NULL,\n	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade\n);\n--> statement-breakpoint\nCREATE UNIQUE INDEX `uploads_todo_name` ON `uploads` (`todo_id`,`name`);--> statement-breakpoint\nALTER TABLE `todos` ADD `slug` text;--> statement-breakpoint\nCREATE UNIQUE INDEX `todos_slug_unique` ON `todos` (`slug`);";
//#endregion
//#region drizzle/1.2.0/meta/_journal.json?raw
var _journal_default = "{\n  \"version\": \"7\",\n  \"dialect\": \"sqlite\",\n  \"entries\": [\n    {\n      \"idx\": 0,\n      \"version\": \"6\",\n      \"when\": 1791826799320,\n      \"tag\": \"0000_todos\",\n      \"breakpoints\": true\n    },\n    {\n      \"idx\": 1,\n      \"version\": \"6\",\n      \"when\": 1791826799719,\n      \"tag\": \"0001_todo_note\",\n      \"breakpoints\": true\n    },\n    {\n      \"idx\": 2,\n      \"version\": \"6\",\n      \"when\": 1791852419369,\n      \"tag\": \"0002_todo_slug_uploads\",\n      \"breakpoints\": true\n    }\n  ]\n}";
//#endregion
//#region node_modules/@funcd-dev/drizzle/dist/index.js
var journalPath = "meta/_journal.json";
/**
* Applies the drizzle-kit migrations in files that the table (default _migrations) lacks, with their rows, in one
* execute, and returns how many it applied. files maps a path to its content, as import.meta.glob with ?raw returns
* it: the folder is the prefix of the key that ends in meta/_journal.json.
*/
async function applyMigrations(ctx, files, options = {}) {
	const alias = options.alias ?? "app";
	const table = options.table ?? "_migrations";
	const journals = Object.keys(files).filter((k) => k === journalPath || k.endsWith(`/${journalPath}`));
	if (journals.length !== 1) throw new Error(`applyMigrations: the files hold ${journals.length === 0 ? `no ${journalPath}` : `two journals: ${journals.join(", ")}`}`);
	const [key] = journals;
	const folder = key.slice(0, -18);
	const migrations = JSON.parse(files[key]).entries.map((e) => {
		const path = `${folder}${e.tag}.sql`;
		const text = files[path];
		if (text === void 0) throw new Error(`applyMigrations: the files hold no ${path}, which ${key} names`);
		return {
			statements: text.split("--> statement-breakpoint"),
			when: e.when,
			hash: createHash("sha256").update(text).digest("hex")
		};
	});
	await ctx.sql.execute(alias, `CREATE TABLE IF NOT EXISTS "${table}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`);
	const [last] = (await ctx.sql.queryValues(alias, `SELECT id, hash, created_at FROM "${table}" ORDER BY created_at DESC LIMIT 1`)).values;
	const pending = migrations.filter((m) => last === void 0 || Number(last[2]) < m.when);
	if (pending.length === 0) return 0;
	await ctx.sql.execute(alias, pending.flatMap((m) => [...m.statements.map((s) => [s, []]), [`INSERT INTO \`${table}\` ("hash", "created_at") VALUES('${m.hash}', '${m.when}')`, []]]));
	return pending.length;
}
//#endregion
//#region src/migrate-1.2.0/main.ts
var migrations = /* #__PURE__ */ Object.assign({
	"../../drizzle/1.2.0/0000_todos.sql": _0000_todos_default,
	"../../drizzle/1.2.0/0001_todo_note.sql": _0001_todo_note_default,
	"../../drizzle/1.2.0/0002_todo_slug_uploads.sql": _0002_todo_slug_uploads_default,
	"../../drizzle/1.2.0/meta/_journal.json": _journal_default
});
var batch = 400;
var insertTodo = "INSERT INTO todos (slug, title, done) VALUES (?, ?, ?) ON CONFLICT (slug) DO NOTHING";
var insertUpload = "INSERT INTO uploads (todo_id, name, size, object_version, recorded_by) SELECT id, ?, ?, ?, ? FROM todos WHERE slug = ? ON CONFLICT (todo_id, name) DO NOTHING";
async function handle(ctx, event) {
	if (!event.data) throw new Error("a hook call carries its input");
	const applied = await applyMigrations(ctx, migrations);
	const todos = [];
	for (const id of await ctx.kv.list("todos")) {
		const todo = await ctx.kv.getJSON("todos", id);
		if (todo) todos.push([insertTodo, [
			id,
			todo.title,
			todo.done === true ? 1 : 0
		]]);
	}
	const uploads = [];
	for (const key of await ctx.kv.list("uploads")) {
		const upload = await ctx.kv.getJSON("uploads", key);
		const slash = key.indexOf("/");
		if (upload && slash > 0) uploads.push([insertUpload, [
			key.slice(slash + 1),
			upload.size,
			upload.version,
			upload.by,
			key.slice(0, slash)
		]]);
	}
	const migrated = await copy(ctx, todos);
	const copied = await copy(ctx, uploads);
	const record = {
		by: "todo-migrate 1.2.0",
		...event.data,
		migrated
	};
	await ctx.kv.put("meta", "last", JSON.stringify(record));
	ctx.log("migrate", record.event, record.to, applied, migrated, copied);
	return {
		migrated,
		uploads: copied
	};
}
async function copy(ctx, statements) {
	let inserted = 0;
	for (let i = 0; i < statements.length; i += batch) for (const r of await ctx.sql.execute("app", statements.slice(i, i + batch))) inserted += r.rowsAffected;
	return inserted;
}
//#endregion
export { handle };
