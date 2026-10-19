import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { safeUrl, validateContent } from '../assets/content-model.js';
import { renderContent } from '../assets/content-renderer.js';
const original = JSON.parse(await readFile(new URL('../assets/content.json',import.meta.url),'utf8'));
assert.deepEqual(validateContent(original),[]);
for (const input of ['javascript:alert(1)',' javascript:alert(1)','data:text/html,test','//example.com/a','../secret','assets/../secret','https://user:pass@example.com/photo.png','https://example.com/\nfile']) {
  assert.equal(safeUrl(input),false,`Unsafe URL accepted: ${input}`);
}
for (const input of ['assets/sahil-portrait.png','project images/movie ticket.png','https://example.com/resume.pdf']) assert.equal(safeUrl(input),true);
for (const change of [d=>d.profile.email='bad',d=>d.projects.push(structuredClone(d.projects[0])),d=>d.profile.resume=' javascript:alert(1)',d=>d.projects[0].source='http://example.com',d=>d.projects[0].download='javascript:alert(1)',d=>d.unknownSecret='test',d=>d.profile.unknownSecret='test',d=>d.skills[0].name='',d=>d.settings.defaultTheme='other']) {
  const data=structuredClone(original);change(data);assert.ok(validateContent(data).length,'Invalid content was accepted');
}
const hostile=structuredClone(original);hostile.profile.name='<img src=x onerror=alert(1)> & Café';
assert.deepEqual(validateContent(hostile),[]);
const html=renderContent(hostile);
assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; Café'));
const snapshot=JSON.stringify(hostile).replaceAll('<',String.fromCharCode(92)+'u003c');
assert.equal(JSON.parse(snapshot).profile.name,hostile.profile.name);
assert.ok(!snapshot.includes('<'));
console.log('PASS content schema, unsafe URL rejection, escaped rendering, and JSON snapshot roundtrip.');
