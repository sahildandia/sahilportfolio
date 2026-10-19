import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('production build excludes credentials and protected editor from public files', async () => {
  const root=new URL('../',import.meta.url);
  execFileSync(process.execPath,['scripts/vercel-build.mjs'],{cwd:fileURLToPath(root),stdio:'pipe'});
  const secret=await readFile(new URL('server/session-key.private',root));
  assert.equal(secret.length,64);
  await access(new URL('public/index.html',root));
  for(const path of ['public/server','public/admin','public/api','public/.env.local']) {
    await assert.rejects(access(new URL(path,root)),{code:'ENOENT'});
  }
  async function verify(directory) {
    for(const item of await readdir(directory,{withFileTypes:true})) {
      const file=new URL(item.name+(item.isDirectory()?'/':''),directory);
      if(item.isDirectory()) await verify(file);
      else assert.ok(!(await readFile(file)).includes(secret),'A private session key reached the public output');
    }
  }
  await verify(new URL('public/',root));
});
