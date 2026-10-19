import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDevServer } from '../scripts/dev-server.mjs';
import { config, credentialsMatch, createSession, verifySession, sessionCookie, clearFailures } from '../server/admin-auth.js';

// Test fixtures only. Production requires private Vercel environment variables.
const settings = { id:'test-owner', password:'test-only-passphrase-42!', secret:'test-only-session-key-'.repeat(3) };

test('signed sessions reject tampering, expiry, and changed credentials', () => {
  const now = Date.now();
  const token = createSession(settings,now);
  assert.equal(verifySession(token,settings,now),true);
  assert.equal(verifySession(token+'x',settings,now),false);
  assert.equal(verifySession(token,settings,now+4*60*60*1000),false);
  assert.equal(verifySession(token,{...settings,password:'changed-password'},now),false);
  assert.equal(verifySession(token,{...settings,id:'other-owner'},now),false);
  assert.equal(config({}),null);
  assert.equal(config({ADMIN_ID:'valid',ADMIN_PASSWORD:'short',ADMIN_SESSION_SECRET:'x'.repeat(32)}),null);
  const cookie = sessionCookie({headers:{host:'portfolio.vercel.app'}},token);
  assert.ok(cookie.includes('; Secure'));
  assert.ok(cookie.includes('; HttpOnly'));
  assert.ok(cookie.includes('; SameSite=Strict'));
});

test('default login uses only a salted verifier and still requires a private signing secret', () => {
  assert.equal(config({}),null);
  const defaults=config({ADMIN_SESSION_SECRET:'fixture-private-session-secret-'.repeat(2)});
  assert.equal(defaults.id,'dandiasahil@gmail.com');
  assert.equal(defaults.password,undefined);
  assert.equal(typeof defaults.passwordHash,'string');
  assert.equal(credentialsMatch(defaults.id,'incorrect-password',defaults),false);
  const session=createSession(defaults);
  assert.equal(verifySession(session,defaults),true);
  const replacement=config({ADMIN_ID:'another-owner',ADMIN_PASSWORD:'fixture-replacement',ADMIN_SESSION_SECRET:defaults.secret});
  assert.equal(credentialsMatch('another-owner','fixture-replacement',replacement),true);
  assert.equal(verifySession(session,replacement),false);
});

test('real HTTP routing enforces login and protects editor assets', async () => {
  const names = ['ADMIN_ID','ADMIN_PASSWORD','ADMIN_SESSION_SECRET'];
  const before = Object.fromEntries(names.map(n=>[n,process.env[n]]));
  for(const n of names) delete process.env[n];
  const server = createDevServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function post(body, origin=base) {
    return fetch(base+'/api/admin-auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  }
  try {
    const unconfigured = await fetch(base+'/api/admin-auth');
    assert.deepEqual(await unconfigured.json(),{configured:false,authenticated:false});
    assert.equal((await post({action:'login',id:settings.id,password:settings.password})).status,503);
    assert.equal((await fetch(base+'/admin/admin.js')).status,401);
    process.env.ADMIN_ID=settings.id;process.env.ADMIN_PASSWORD=settings.password;process.env.ADMIN_SESSION_SECRET=settings.secret;
    const publicPage=await fetch(base+'/index.html');assert.equal(publicPage.status,200);assert.ok((await publicPage.text()).includes('Sahil'));
    const login=await fetch(base+'/admin/');assert.equal(login.status,200);assert.ok((await login.text()).includes('id="admin-login"'));
    assert.equal(login.headers.get('cache-control'),'private, no-store, max-age=0');
    assert.equal(login.headers.get('x-frame-options'),'DENY');
    for(const path of ['/admin/admin.js','/admin/access.js','/admin/admin.css','/api/admin-page?file=admin.js']) assert.equal((await fetch(base+path)).status,401,path);
    assert.equal((await fetch(base+'/api/admin-page?file=../.env.local')).status,404);
    assert.equal((await fetch(base+'/.env.local')).status,404);
    assert.equal((await post({action:'login',id:settings.id,password:settings.password},'https://another-site.invalid')).status,403);
    assert.equal((await post({action:'login',id:'wrong',password:'wrong'})).status,401);
    const correct=await post({action:'login',id:settings.id,password:settings.password});
    assert.equal(correct.status,200);
    const cookie=correct.headers.get('set-cookie').split(';')[0];
    assert.ok(correct.headers.get('set-cookie').includes('HttpOnly'));
    const status=await fetch(base+'/api/admin-auth',{headers:{Cookie:cookie}});assert.equal((await status.json()).authenticated,true);
    const editor=await fetch(base+'/admin/',{headers:{Cookie:cookie}});assert.equal(editor.status,200);assert.ok((await editor.text()).includes('id="content-form"'));
    const script=await fetch(base+'/admin/admin.js',{headers:{Cookie:cookie}});assert.equal(script.status,200);assert.ok((await script.text()).includes('requireAdminSession'));
    assert.equal((await fetch(base+'/admin/admin.js',{headers:{Cookie:cookie+'bad'}})).status,401);
    const logout=await post({action:'logout'});assert.equal(logout.status,200);assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
    assert.equal((await (await fetch(base+'/api/admin-auth')).json()).authenticated,false);
    clearFailures('unused');
    for(let i=0;i<5;i++)assert.equal((await post({action:'login',id:'wrong',password:'wrong'})).status,401);
    const limited=await post({action:'login',id:'wrong',password:'wrong'});assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))>0);
    const routes=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));
    assert.equal(routes.routes[0].dest,'/api/admin-page?file=$1');
    assert.equal(routes.routes[1].handle,'filesystem');
  } finally {
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
    for(const n of names) before[n] === undefined ? delete process.env[n] : process.env[n]=before[n];
  }
});
