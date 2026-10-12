// A Drizzle sqlite-proxy database over context.sql (funcd ADR-0233): a SELECT or WITH goes to queryValues, any other
// statement to execute, since Drizzle sends an insert with returning() as a read. A batch is one execute, so it
// applies all of its statements or none.
import type { FunctionContext, SQLParam } from '@funcd-dev/shim';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

type Method = 'run' | 'all' | 'values' | 'get';

const reads = /^\s*(select|with)\b/i;

async function rows(ctx: FunctionContext, alias: string, query: string, params: unknown[], method: Method) {
  const p = params as SQLParam[];
  const values = reads.test(query)
    ? (await ctx.sql.queryValues(alias, query, p)).values
    : ((await ctx.sql.execute(alias, query, p)).values ?? []);
  return method === 'get' ? (values[0] ?? []) : values;
}

export function proxyDB(ctx: FunctionContext, alias: string) {
  return drizzle(
    async (query, params, method) => ({ rows: await rows(ctx, alias, query, params, method) }),
    async (queries) => {
      const results = await ctx.sql.execute(
        alias,
        queries.map((q) => [q.sql, q.params as SQLParam[]] as [string, SQLParam[]]),
      );
      return results.map((r, i) => ({
        rows: queries[i].method === 'get' ? (r.values?.[0] ?? []) : (r.values ?? []),
      }));
    },
  );
}
