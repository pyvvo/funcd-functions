// The caller of funcd's addon-rauthy-signin lane (funcd ADR-0338): it binds the add-on object echo, a traefik/whoami
// engine that answers the headers it gets, and calls it through ctx.addon.fetch and through the add-on proxy, asks for
// a path the object keeps private, and dials the engine's own address, which funcd's fence refuses.

export const handle = async (ctx, event) => {
  const { address } = event.data ?? {};
  const viaFetch = await ctx.addon.fetch('echo', '/', { headers: { 'X-Lane': 'fetch' } });
  const proxy = await fetch(`${process.env.FUNCD_ADDON_ECHO_URL}/`, {
    headers: { 'X-Funcd-Addon-Token': process.env.FUNCD_ADDON_ECHO_TOKEN, 'X-Lane': 'proxy' },
  });
  let kept;
  try {
    kept = (await ctx.addon.fetch('echo', '/private')).status;
  } catch (err) {
    kept = err.status ?? String(err);
  }
  let dial;
  try {
    dial = (await fetch(`http://${address}/`, { signal: AbortSignal.timeout(3000) })).status;
  } catch {
    dial = 'refused';
  }
  return {
    fetch: { status: viaFetch.status, body: await viaFetch.text() },
    proxy: { status: proxy.status, body: await proxy.text() },
    private: kept,
    dial,
  };
};
