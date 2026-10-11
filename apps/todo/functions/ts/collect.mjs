import { createRequire as __funcdCreateRequire } from "node:module";
__funcdCreateRequire(import.meta.url);
//#region src/collect.ts
async function handle(ctx, event) {
	const titles = [];
	for (const key of await ctx.blob.list("files")) {
		const file = await ctx.blob.get("files", key);
		if (file) titles.push(new TextDecoder().decode(file));
	}
	ctx.log("collect", titles.length);
	return {
		tick: event.data?.tick ?? "",
		titles,
		collected_by: "collect"
	};
}
//#endregion
export { handle };
