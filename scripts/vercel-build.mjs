import { cp, mkdir, rm } from 'node:fs/promises';
import { prepareSessionKey } from '../server/session-key.js';
import './build.mjs';

// This file is bundled with serverless functions only. Never copy server/ or
// admin/ into the public output. Every deployment gets an independent key.
await prepareSessionKey({rotate:true});
const output=new URL('../public/',import.meta.url);
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const name of ['index.html','about.html','projects.html','experience.html','contact.html','assets','project images','logo.png']) {
  await cp(new URL('../'+name,import.meta.url),new URL(name,output),{recursive:true});
}
console.log('Prepared static output and private server authentication.');
