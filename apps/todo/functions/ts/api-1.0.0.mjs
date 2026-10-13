import { createRequire as __funcdCreateRequire } from "node:module";
__funcdCreateRequire(import.meta.url);
//#region src/shared.ts
var utf8$1 = new TextEncoder();
function requireToken(op, token) {
	const want = process.env.TODO_API_TOKEN;
	if (!want || token !== want) throw new Error(`${op} needs the API token`);
}
async function attach(ctx, id, name, content) {
	if (!await ctx.kv.getJSON("todos", id)) throw new Error(`attach needs an existing todo, not "${id}"`);
	await putUpload(ctx, id, name, content);
}
async function putUpload(ctx, id, name, content) {
	if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(name)) throw new Error("attach needs a file name of letters, digits, dots, dashes and underscores, not starting with a dot");
	await ctx.blob.put("uploads", `${id}/${name}`, utf8$1.encode(content));
	ctx.log("attach", id, name);
}
async function uploadsOf(ctx, id) {
	const uploads = [];
	for (const key of (await ctx.kv.list("uploads", `${id}/`)).sort()) {
		const record = await ctx.kv.getJSON("uploads", key);
		if (record) uploads.push({
			name: key.slice(id.length + 1),
			size: record.size
		});
	}
	return uploads;
}
function hang() {
	for (;;);
}
//#endregion
//#region src/api-1.0.0.ts
var version = "1.0.0";
var utf8 = new TextEncoder();
async function handle(ctx, event) {
	const input = event.data ?? { op: "list" };
	switch (input.op) {
		case "add": return add(ctx, input);
		case "get": return get(ctx, input.id ?? "");
		case "attach":
			requireToken("attach", input.token);
			await attach(ctx, input.id ?? "", input.name ?? "", input.content ?? "");
			return {
				version,
				id: input.id
			};
		case "hang":
			requireToken("hang", input.token);
			return hang();
		default: return list(ctx);
	}
}
function slug(title) {
	return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
async function add(ctx, input) {
	requireToken("add", input.token);
	const title = input.title ?? "";
	const id = slug(title);
	if (id === "") throw new Error("add needs a title");
	const record = { title };
	await ctx.kv.put("todos", id, JSON.stringify(record));
	await ctx.blob.put("files", `${id}.txt`, utf8.encode(title));
	await ctx.blob.put("copies", `${id}.json`, utf8.encode(JSON.stringify(record)));
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
			title: record.title
		}] : [],
		attachment: file ? new TextDecoder().decode(file) : null,
		uploads: await uploadsOf(ctx, id)
	};
}
async function list(ctx) {
	const todos = [];
	for (const id of (await ctx.kv.list("todos")).sort()) {
		const record = await ctx.kv.getJSON("todos", id);
		if (record) todos.push({
			id,
			title: record.title
		});
	}
	return {
		version,
		todos,
		migration: await ctx.kv.getJSON("meta", "last"),
		release: await ctx.kv.getJSON("warm", "last"),
		greeting: process.env.TODO_GREETING ?? "",
		tokenSet: Boolean(process.env.TODO_API_TOKEN)
	};
}
//#endregion
export { handle };
