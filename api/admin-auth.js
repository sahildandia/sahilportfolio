import { config, credentialsMatch, createSession, readSession, sessionCookie, sameOrigin, secureHeaders, json, readJson, attemptKey, attemptsBlocked, recordFailure, clearFailures } from '../server/admin-auth.js';

export default async function handler(req, res) {
  secureHeaders(res);
  const settings = config();
  if (req.method === 'GET') return json(res, 200, { configured: Boolean(settings), authenticated: Boolean(settings && readSession(req, settings)) });
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return json(res, 405, { error: 'Method not allowed.' }); }
  if (!sameOrigin(req)) return json(res, 403, { error: 'Please sign in from this website.' });
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'Use a JSON request.' });
  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: 'The sign-in request could not be read.' }); }
  if (body?.action === 'logout') { res.setHeader('Set-Cookie', sessionCookie(req, '', true)); return json(res, 200, { authenticated: false }); }
  if (!settings) return json(res, 503, { error: 'Admin sign-in has not been configured. Set the admin credentials in your Vercel environment settings, then redeploy.' });
  if (body?.action !== 'login' || typeof body.id !== 'string' || typeof body.password !== 'string' || body.id.length > 100 || body.password.length > 256) return json(res, 400, { error: 'Enter an admin ID and password.' });
  const key = attemptKey(req);
  const retry = attemptsBlocked(key);
  if (retry) { res.setHeader('Retry-After', String(retry)); return json(res, 429, { error: 'Too many sign-in attempts. Please try again in 15 minutes.' }); }
  if (!credentialsMatch(body.id, body.password, settings)) { recordFailure(key); return json(res, 401, { error: 'The admin ID or password is incorrect.' }); }
  clearFailures(key);
  res.setHeader('Set-Cookie', sessionCookie(req, createSession(settings)));
  return json(res, 200, { authenticated: true });
}
