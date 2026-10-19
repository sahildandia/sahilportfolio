import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

export const sessionKeyFile = new URL('./session-key.private',import.meta.url);

export async function prepareSessionKey({rotate=false,file=sessionKeyFile}={}) {
  const value = randomBytes(48).toString('base64url');
  try {
    await writeFile(file,value,{encoding:'utf8',mode:0o600,flag:rotate?'w':'wx'});
  } catch(error) {
    if(error.code !== 'EEXIST')throw error;
    const existing=await readFile(file,'utf8');
    if(!/^[A-Za-z0-9_-]{64}$/.test(existing))throw new Error('The local session key is invalid. Delete the generated key file and restart.');
  }
}
