import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DEFAULT_ADMIN_ID, DEFAULT_PASSWORD_HASH, DEFAULT_PASSWORD_SALT } from './default-admin.js';
import { readFileSync } from 'node:fs';

export const SESSION_SECONDS = 4 * 60 * 60;
export const COOKIE_NAME = 'portfolio_admin';
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function deploymentSecret() {
  try { return readFileSync(new URL('./session-key.private',import.meta.url),'utf8').trim(); }
  catch { return ''; }
}

export function config(env = process.env, generatedSecret = deploymentSecret()) {
  const id = env.ADMIN_ID || DEFAULT_ADMIN_ID;
  const password = env.ADMIN_PASSWORD || '';
  const secret = env.ADMIN_SESSION_SECRET || generatedSecret;
  return id.trim() === id && id.length >= 3 && id.length <= 100 && (!password || password.length >= 8) && password.length <= 256 && secret.length >= 32
    ? { id, ...(password ? {password} : {passwordHash:DEFAULT_PASSWORD_HASH}), secret } : null;
}

function equal(a, b) {
  const digest = value => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export function credentialsMatch(id, password, settings) {
  // Evaluate both comparisons, and never reveal whether only the ID matched.
  const idMatches = equal(id, settings.id);
  const passwordMatches = settings.password !== undefined
    ? equal(password, settings.password)
    : timingSafeEqual(scryptSync(String(password),DEFAULT_PASSWORD_SALT,64),Buffer.from(settings.passwordHash,'hex'));
  return idMatches && passwordMatches;
}

function signingKey(settings) {
  // Changing either login credential revokes existing sessions as well.
  return createHmac('sha256', settings.secret).update(settings.id).update('\0').update(settings.password ?? settings.passwordHash).digest();
}

export function createSession(settings, now = Date.now()) {
  const issued = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: settings.id, iat: issued, exp: issued + SESSION_SECONDS, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  const signature = createHmac('sha256', signingKey(settings)).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySession(token, settings, now = Date.now()) {
  if (!settings || typeof token !== 'string' || token.length > 2048) return false;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts.every(p => /^[A-Za-z0-9_-]+$/.test(p))) return false;
  const expected = createHmac('sha256', signingKey(settings)).update(parts[0]).digest('base64url');
  if (!equal(parts[1], expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    const current = Math.floor(now / 1000);
    return payload.sub === settings.id && Number.isInteger(payload.exp) && Number.isInteger(payload.iat)
      && payload.iat <= current + 30 && payload.exp > current && payload.exp - payload.iat === SESSION_SECONDS;
  } catch { return false; }
}

export function readSession(req, settings) {
  const cookies = String(req.headers.cookie || '').split(';').map(v => v.trim());
  const cookie = cookies.find(v => v.startsWith(`${COOKIE_NAME}=`));
  return verifySession(cookie?.slice(COOKIE_NAME.length + 1), settings);
}

function isLocal(req) {
  return process.env.VERCEL !== '1' && /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(req.headers.host || '');
}

export function sessionCookie(req, value, clear = false) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${isLocal(req) ? '' : '; Secure'}`;
}

export function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin);
    const protocol = isLocal(req) ? 'http:' : 'https:';
    return origin.protocol === protocol && origin.host === req.headers.host;
  } catch { return false; }
}

export function secureHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Vary', 'Cookie');
}

export function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export async function readJson(req) {
  const rawLength = Number(req.headers['content-length'] || 0);
  if (rawLength > 4096) throw new Error('Request too large');
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > 4096) throw new Error('Request too large');
    return JSON.parse(raw);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 4096) throw new Error('Request too large');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function attemptKey(req) {
  const address = process.env.VERCEL === '1'
    ? String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
    : req.socket?.remoteAddress || 'local';
  return createHash('sha256').update(address).digest('hex');
}

export function attemptsBlocked(key, now = Date.now()) {
  for (const [k, value] of failures) if (value.until <= now) failures.delete(k);
  const record = failures.get(key);
  return record && record.count >= MAX_ATTEMPTS ? Math.ceil((record.until - now) / 1000) : 0;
}
export function recordFailure(key, now = Date.now()) {
  if (failures.size >= 2000 && !failures.has(key)) failures.delete(failures.keys().next().value);
  const current = failures.get(key);
  failures.set(key, current && current.until > now ? { ...current, count: current.count + 1 } : { count: 1, until: now + WINDOW_MS });
}
export function clearFailures(key) { failures.delete(key); }
