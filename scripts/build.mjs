import { readFile, writeFile } from 'node:fs/promises';
import { renderContent } from '../assets/content-renderer.js';
import { validateContent, escapeHtml } from '../assets/content-model.js';
const root = new URL('../', import.meta.url);
const content = JSON.parse(await readFile(new URL('assets/content.json',root),'utf8'));
const errors = validateContent(content);
if(errors.length)throw new Error(errors.join('\n'));
const snapshot=JSON.stringify(content).replaceAll('<',String.fromCharCode(92)+'u003c');
const html=`<!doctype html>
<html lang="en" data-theme="${content.settings.defaultTheme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f1efe6"><meta name="description" content="${escapeHtml(content.profile.intro)}"><title>${escapeHtml(content.profile.name)} — Developer Portfolio</title><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="assets/portfolio.css"><link rel="stylesheet" href="assets/refinement.css"><script type="module" src="assets/portfolio.js"></script></head>
<body><div id="site-root">${renderContent(content)}</div><script type="application/json" id="content-snapshot">${snapshot}</script><noscript><p class="noscript-note">JavaScript enables project details, search, and themes. All content and direct contact links remain available.</p></noscript></body></html>`;
for(const name of ['index.html','about.html','projects.html','experience.html','contact.html'])await writeFile(new URL(name,root),html.replace(/[ \t]+$/gm,'')+String.fromCharCode(10));
console.log('Validated content and generated five static pages.');
