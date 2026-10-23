// The files Function of the volumes App (funcd ADR-0262). It reaches each of its volumes through the path in
// FUNCD_VOLUME_<NAME>: data, a local volume kept across workers and redeploys, and scratch, an emptyDir each worker
// gets empty.
import { randomUUID } from 'node:crypto';
import { open, readdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:os';
import { dirname, join } from 'node:path';

import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';

export interface FuncInput {
  op: 'write' | 'read' | 'list' | 'fill' | 'peek' | 'info' | 'crash';
  volume?: 'data' | 'scratch';
  name?: string;
  text?: string;
  bytes?: number;
}

export interface FuncOutput {
  text?: string;
  names?: string[];
  written?: number;
  pid?: number;
  boot?: string;
  error?: string;
  code?: string;
}

// boot names this worker: a new worker, after a crash or a redeploy, draws another.
const boot = randomUUID();

function volumeDir(volume: string): string {
  const dir = process.env[`FUNCD_VOLUME_${volume.toUpperCase()}`];
  if (!dir) {
    throw new Error(`this Function has no volume ${volume}`);
  }
  return dir;
}

// failure names an error's errno: libuv leaves some unnamed, EDQUOT among them ("Unknown system error -122").
function failure(err: unknown): FuncOutput {
  const e = err as NodeJS.ErrnoException;
  const named = Object.entries(constants.errno).find(([, n]) => n === -(e.errno ?? 0))?.[0];
  return { error: e.message, code: named ?? e.code ?? 'ERROR' };
}

// fill writes bytes of zeros into the volume's file fill, flushed, so a write past the volume's size fails here.
async function fill(dir: string, bytes: number): Promise<FuncOutput> {
  const f = await open(join(dir, 'fill'), 'w');
  const chunk = Buffer.alloc(64 * 1024);
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
    return { ...failure(err), written };
  } finally {
    await f.close();
  }
}

export async function handle(_ctx: FunctionContext, event: CloudEvent<FuncInput>): Promise<FuncOutput> {
  const input = event.data ?? { op: 'info' };
  const dir = volumeDir(input.volume ?? 'data');
  try {
    switch (input.op) {
      case 'write':
        await writeFile(join(dir, input.name ?? 'note'), input.text ?? '');
        return {};
      case 'read':
        return { text: await readFile(join(dir, input.name ?? 'note'), 'utf8') };
      case 'list':
        return { names: (await readdir(dir)).sort() };
      case 'fill':
        return await fill(dir, input.bytes ?? 1);
      // peek lists the directory above the volume: the worker sees its own volumes there, and no other Function's.
      case 'peek':
        return { names: (await readdir(dirname(dir))).sort() };
      case 'info':
        return { pid: process.pid, boot };
      case 'crash':
        setTimeout(() => process.exit(1), 50);
        return { pid: process.pid, boot };
    }
  } catch (err) {
    return failure(err);
  }
  return {};
}
