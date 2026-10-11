// The operations that both versions of the API share: the token check, an upload, the uploads the intake Function
// recorded, and the call that hangs the API for funcd's liveness check.
import type { FunctionContext } from '@funcd-dev/shim';

import type { UploadRecord } from './records';

/** An upload of a todo, as the intake Function recorded it. */
export interface Upload {
  name: string;
  size: number;
}

const utf8 = new TextEncoder();

// requireToken refuses a call that changes the App without the token of Secret todo-api-keys.
export function requireToken(op: string, token: string | undefined): void {
  const want = process.env.TODO_API_TOKEN;
  if (!want || token !== want) {
    throw new Error(`${op} needs the API token`);
  }
}

// attach puts content under uploads/<id>/<name> of Bucket todo-files. The blob EventSource todo-uploads fires for the
// object, and its Sensor hands it to the intake Function, which records it.
export async function attach(ctx: FunctionContext, id: string, name: string, content: string): Promise<void> {
  if (!(await ctx.kv.getJSON('todos', id))) {
    throw new Error(`attach needs an existing todo, not "${id}"`);
  }
  if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(name)) {
    throw new Error('attach needs a file name of letters, digits, dots, dashes and underscores, not starting with a dot');
  }
  await ctx.blob.put('uploads', `${id}/${name}`, utf8.encode(content));
  ctx.log('attach', id, name);
}

// uploadsOf lists the uploads of a todo that the intake Function recorded, by name.
export async function uploadsOf(ctx: FunctionContext, id: string): Promise<Upload[]> {
  const uploads: Upload[] = [];
  for (const key of (await ctx.kv.list('uploads', `${id}/`)).sort()) {
    const record = await ctx.kv.getJSON<UploadRecord>('uploads', key);
    if (record) {
      uploads.push({ name: key.slice(id.length + 1), size: record.size });
    }
  }
  return uploads;
}

// hang blocks the event loop for good, as a handler stuck in a synchronous loop does: the replica stops answering
// /health/liveness, and funcd replaces it after runtime.livenessTimeout (funcd ADR-0215).
export function hang(): never {
  for (;;) {
    // never yields to the event loop
  }
}
