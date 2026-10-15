// The Site sets ingress.baseHref, so the index carries the Site's mount as its base (funcd ADR-0239), and
// config.json resolves under the mount at any path and on a deep link.
const res = await fetch(new URL('config.json', document.baseURI), { cache: 'no-cache' });
if (!res.ok) {
  throw new Error(`config.json: ${res.status}`);
}
const config = await res.json();
if (typeof config.API_URL !== 'string' || config.API_URL === '') {
  throw new Error('config.json: API_URL is missing');
}
document.getElementById('api-url').textContent = config.API_URL;
document.getElementById('new-dashboard').textContent = config.NEW_DASHBOARD ?? 'false';
