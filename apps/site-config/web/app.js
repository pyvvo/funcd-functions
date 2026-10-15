// config.json sits at the root of the bundle, beside this script; a URL relative to the page would miss it on a deep
// link, where the SPA fallback answers with the index (funcd ADR-0239).
const res = await fetch(new URL('config.json', import.meta.url), { cache: 'no-cache' });
if (!res.ok) {
  throw new Error(`config.json: ${res.status}`);
}
const config = await res.json();
if (typeof config.API_URL !== 'string' || config.API_URL === '') {
  throw new Error('config.json: API_URL is missing');
}
document.getElementById('api-url').textContent = config.API_URL;
document.getElementById('new-dashboard').textContent = config.NEW_DASHBOARD ?? 'false';
