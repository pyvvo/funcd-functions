// The collect step of Workflow todo-plan: it reads the title of every todo from its attachment, since a step binds
// only the Workflow's own KV stores (funcd ADR-0178), and passes the titles, with the run's tick, to the Python rank
// step.
import type { CloudEvent, FunctionContext } from '@funcd-dev/shim';

export interface FuncInput {
  tick: string;
}

export interface FuncOutput {
  tick: string;
  titles: string[];
  collected_by: string;
}

export async function handle(ctx: FunctionContext, event: CloudEvent<FuncInput>): Promise<FuncOutput> {
  const titles: string[] = [];
  for (const key of await ctx.blob.list('files')) {
    const file = await ctx.blob.get('files', key);
    if (file) {
      titles.push(new TextDecoder().decode(file));
    }
  }
  ctx.log('collect', titles.length);
  return { tick: event.data?.tick ?? '', titles, collected_by: 'collect' };
}
