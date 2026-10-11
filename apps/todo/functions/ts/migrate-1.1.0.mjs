import { createRequire as __funcdCreateRequire } from "node:module";
__funcdCreateRequire(import.meta.url);
//#region src/migrate-1.1.0.ts
async function handle(ctx, event) {
	if (!event.data) throw new Error("a hook call carries its input");
	let migrated = 0;
	for (const id of await ctx.kv.list("todos")) {
		const todo = await ctx.kv.getJSON("todos", id);
		if (todo && typeof todo.done !== "boolean") {
			const next = {
				title: todo.title,
				done: false
			};
			await ctx.kv.put("todos", id, JSON.stringify(next));
			migrated++;
		}
	}
	const record = {
		by: "todo-migrate 1.1.0",
		...event.data,
		migrated
	};
	await ctx.kv.put("meta", "last", JSON.stringify(record));
	ctx.log("migrate", record.event, record.to, migrated);
	return { migrated };
}
//#endregion
export { handle };
