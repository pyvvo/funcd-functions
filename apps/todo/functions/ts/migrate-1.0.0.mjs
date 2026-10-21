import { createRequire as __funcdCreateRequire } from "node:module";
__funcdCreateRequire(import.meta.url);
import { createHash } from "node:crypto";
//#region drizzle/1.0.0/0000_todos.sql?raw
var _0000_todos_default = "CREATE TABLE `todos` (\n	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,\n	`title` text NOT NULL,\n	`done` integer DEFAULT 0 NOT NULL\n);\n";
//#endregion
//#region drizzle/1.0.0/meta/_journal.json?raw
var _journal_default = "{\n  \"version\": \"7\",\n  \"dialect\": \"sqlite\",\n  \"entries\": [\n    {\n      \"idx\": 0,\n      \"version\": \"6\",\n      \"when\": 1791826799320,\n      \"tag\": \"0000_todos\",\n      \"breakpoints\": true\n    }\n  ]\n}";
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
//#region src/migrate-1.0.0/main.ts
var migrations = /* #__PURE__ */ Object.assign({
	"../../drizzle/1.0.0/0000_todos.sql": _0000_todos_default,
	"../../drizzle/1.0.0/meta/_journal.json": _journal_default
});
async function handle(ctx, event) {
	if (!event.data) throw new Error("a hook call carries its input");
	if (process.env.TODO_SQL === "on") ctx.log("migrate", "sql", await applyMigrations(ctx, migrations));
	const record = {
		by: "todo-migrate 1.0.0",
		...event.data,
		migrated: 0
	};
	await ctx.kv.put("meta", "last", JSON.stringify(record));
	ctx.log("migrate", record.event, record.to, record.migrated);
	return { migrated: 0 };
}
//#endregion
export { handle };
