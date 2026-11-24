// The App's hello Function, which serves HTTP on its host. A request to the Tunnel's public name reaches it through
// frps and frpc, which rewrites its Host to this host, then funcd's edge. The export carries the tag of the shim's
// http(app), a global symbol, so the file needs no package.
const hello = (request) =>
  new Response(`hello from frp-bunny, through ${request.headers.get('host')}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

export const handle = Object.assign(hello, { [Symbol.for('funcd.http')]: true });
