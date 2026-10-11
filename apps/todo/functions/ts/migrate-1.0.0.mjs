import { createRequire as __funcdCreateRequire } from "node:module";
__funcdCreateRequire(import.meta.url);
//#region src/migrate-1.0.0.ts
async function handle(ctx, event) {
	if (!event.data) throw new Error("a hook call carries its input");
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
