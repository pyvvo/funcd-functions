import { createRequire as __funcdCreateRequire } from "node:module";
__funcdCreateRequire(import.meta.url);
//#region src/api-1.1.0.ts
var version = "1.1.0";
var utf8 = new TextEncoder();
async function handle(ctx, event) {
	const input = event.data ?? { op: "list" };
	switch (input.op) {
		case "add": return add(ctx, input);
		case "get": return get(ctx, input.id ?? "");
		default: return list(ctx);
	}
}
function slug(title) {
	return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
async function add(ctx, input) {
	const token = process.env.TODO_API_TOKEN;
	if (!token || input.token !== token) throw new Error("add needs the API token");
	const title = input.title ?? "";
	const id = slug(title);
	if (id === "") throw new Error("add needs a title");
	const record = {
		title,
		done: false
	};
	await ctx.kv.put("todos", id, JSON.stringify(record));
	await ctx.blob.put("files", `${id}.txt`, utf8.encode(title));
	await ctx.blob.put("uploads", `${id}.json`, utf8.encode(JSON.stringify(record)));
	ctx.log("add", id);
	return {
		version,
		id
	};
}
async function get(ctx, id) {
	const record = await ctx.kv.getJSON("todos", id);
	const file = await ctx.blob.get("files", `${id}.txt`);
	return {
		version,
		todos: record ? [{
			id,
			title: record.title,
			done: record.done === true
		}] : [],
		attachment: file ? new TextDecoder().decode(file) : null
	};
}
async function list(ctx) {
	const todos = [];
	let unmigrated = 0;
	for (const id of (await ctx.kv.list("todos")).sort()) {
		const record = await ctx.kv.getJSON("todos", id);
		if (!record) continue;
		if (typeof record.done === "boolean") todos.push({
			id,
			title: record.title,
			done: record.done
		});
		else unmigrated++;
	}
	return {
		version,
		todos,
		unmigrated,
		migration: await ctx.kv.getJSON("meta", "last"),
		release: await ctx.kv.getJSON("warm", "last"),
		greeting: process.env.TODO_GREETING ?? "",
		tokenSet: Boolean(process.env.TODO_API_TOKEN)
	};
}
//#endregion
export { handle };
