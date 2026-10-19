import { readFile } from 'node:fs/promises';
import { config, readSession, secureHeaders, json } from '../server/admin-auth.js';

const allowed = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['admin.css', 'text/css; charset=utf-8'],
  ['admin.js', 'text/javascript; charset=utf-8'],
  ['access.js', 'text/javascript; charset=utf-8'],
  ['login.html', 'text/html; charset=utf-8'],
]);

export default async function handler(req, res) {
  secureHeaders(res);
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' https: data:; connect-src 'self' https://api.github.com; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'none'");
  if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return json(res, 405, { error: 'Method not allowed.' }); }
  let file;
  try {
    const url = new URL(req.url, 'https://portfolio.invalid');
    const routeFile = req.query?.file ?? url.searchParams.get('file');
    if (routeFile !== undefined && routeFile !== null && typeof routeFile !== 'string') throw new Error('Invalid query');
    file = routeFile || (url.pathname.startsWith('/admin/') ? decodeURIComponent(url.pathname.slice('/admin/'.length)) : '') || 'index.html';
  } catch { return json(res, 400, { error: 'Invalid path.' }); }
  if (!allowed.has(file)) return json(res, 404, { error: 'Page not found.' });
  const authenticated = readSession(req, config());
  if (!authenticated && !['index.html','login.html'].includes(file)) return json(res, 401, { error: 'Admin sign-in required.' });
  if (authenticated && file === 'login.html') { res.statusCode = 303; res.setHeader('Location','/admin/'); return res.end(); }
  try {
    const content = await readFile(new URL(`../admin/${authenticated ? file : 'login.html'}`, import.meta.url));
    res.statusCode = 200;
    res.setHeader('Content-Type', authenticated ? allowed.get(file) : 'text/html; charset=utf-8');
    return res.end(req.method === 'HEAD' ? undefined : content);
  } catch { return json(res, 500, { error: 'The admin page could not be loaded.' }); }
}
