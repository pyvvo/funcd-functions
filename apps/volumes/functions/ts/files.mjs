import { createRequire as __funcdCreateRequire } from "node:module";
__funcdCreateRequire(import.meta.url);
import { randomUUID } from "node:crypto";
import { open, readFile, readdir, writeFile } from "node:fs/promises";
import { constants } from "node:os";
import { dirname, join } from "node:path";
// src/files/main.ts
var boot = randomUUID();
function volumeDir(volume) {
	const dir = process.env[`FUNCD_VOLUME_${volume.toUpperCase()}`];
	if (!dir) throw new Error(`this Function has no volume ${volume}`);
	return dir;
}
function failure(err) {
	const e = err;
	const named = Object.entries(constants.errno).find(([, n]) => n === -(e.errno ?? 0))?.[0];
	return {
		error: e.message,
		code: named ?? e.code ?? "ERROR"
	};
}
async function fill(dir, bytes) {
	const f = await open(join(dir, "fill"), "w");
	const chunk = Buffer.alloc(65536);
	let written = 0;
	try {
		while (written < bytes) {
			const n = Math.min(chunk.length, bytes - written);
			await f.write(chunk, 0, n);
			written += n;
		}
		await f.sync();
		return { written };
	} catch (err) {
		return {
			...failure(err),
			written
		};
	} finally {
		await f.close();
	}
}
async function handle(_ctx, event) {
	const input = event.data ?? { op: "info" };
	const dir = volumeDir(input.volume ?? "data");
	try {
		switch (input.op) {
			case "write":
				await writeFile(join(dir, input.name ?? "note"), input.text ?? "");
				return {};
			case "read": return { text: await readFile(join(dir, input.name ?? "note"), "utf8") };
			case "list": return { names: (await readdir(dir)).sort() };
			case "fill": return await fill(dir, input.bytes ?? 1);
			case "peek": return { names: (await readdir(dirname(dir))).sort() };
			case "info": return {
				pid: process.pid,
				boot
			};
			case "crash":
				setTimeout(() => process.exit(1), 50);
				return {
					pid: process.pid,
					boot
				};
		}
	} catch (err) {
		return failure(err);
	}
	return {};
}
export { handle };
