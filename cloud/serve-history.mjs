import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
const root = fileURLToPath(new URL('../app/', import.meta.url));
export function historyServer() {
  return createServer(async (request, response) => {
    try {
      if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!path.startsWith(root.endsWith(sep) ? root : root+sep)) throw new Error('outside root');
      const content = await readFile(path);
      response.writeHead(200, { 'Content-Type': ({'.html':'text/html','.mjs':'text/javascript','.css':'text/css'}[extname(path)] || 'application/octet-stream')+'; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  historyServer().listen(port, '127.0.0.1', () => console.log(`Find Hub history: http://127.0.0.1:${port} (local only)`));
}
