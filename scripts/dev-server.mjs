// Local equivalent of the Vercel routing contract. Not a production server.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import auth from '../api/admin-auth.js';
import admin from '../api/admin-page.js';
import { prepareSessionKey } from '../server/session-key.js';
export const root = resolve(fileURLToPath(new URL('../',import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
export function createDevServer() {
  return createServer(async (req,res) => {
    try {
      const url = new URL(req.url,'http://localhost');
      if (url.pathname === '/api/admin-auth') return await auth(req,res);
      if (url.pathname === '/api/admin-page') return await admin(req,res);
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
        const file = decodeURIComponent(url.pathname.slice('/admin'.length).replace(/^\//,'')) || 'index.html';
        req.url = `/api/admin-page?file=${encodeURIComponent(file)}`;
        return await admin(req,res);
      }
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.split('/').some(p=>p.startsWith('.')) || /^\/(api|server|scripts|tests)(\/|$)/.test(pathname)) { res.writeHead(404); return res.end('Not found'); }
      if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end('Method not allowed'); }
      let path = resolve(root,'.'+pathname);
      if (!path.startsWith(root+sep)) { res.writeHead(404); return res.end('Not found'); }
      if ((await stat(path)).isDirectory()) path = resolve(path,'index.html');
      const body = await readFile(path);
      res.setHeader('Content-Type',types[extname(path)] || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Cache-Control','no-store');
      res.end(req.method==='HEAD' ? undefined : body);
    } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareSessionKey();
  const port = Number(process.env.PORT || 8000);
  const server = createDevServer();
  server.listen(port,'0.0.0.0',()=>console.log(`Portfolio development server listening on port ${server.address().port}.`));
}
