import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist/codex-musicae');
const port = Number(process.env.PORT ?? '4173');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const isInsideRoot = (path) => path === root || path.startsWith(`${root}/`);

const resolveRequestPath = (requestUrl) => {
  const pathname = new URL(requestUrl, 'http://localhost').pathname;
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '');
  const requestedPath = normalize(join(root, relativePath));
  return isInsideRoot(requestedPath) ? requestedPath : undefined;
};

const serveFile = async (request, response, path) => {
  try {
    const fileStats = await stat(path);
    if (!fileStats.isFile()) {
      return false;
    }

    response.writeHead(200, {
      'Content-Type': contentTypes[extname(path)] ?? 'application/octet-stream',
    });
    if (request.method === 'HEAD') {
      response.end();
    } else {
      createReadStream(path).pipe(response);
    }
    return true;
  } catch {
    return false;
  }
};

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405).end();
    return;
  }

  const requestedPath = request.url ? resolveRequestPath(request.url) : undefined;
  const served = requestedPath ? await serveFile(request, response, requestedPath) : false;
  if (served) {
    return;
  }

  if (await serveFile(request, response, join(root, 'index.html'))) {
    return;
  }

  response.writeHead(404).end();
});

server.listen(port, '127.0.0.1');

const shutdown = () => server.close(() => process.exit(0));
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

console.log(`Serving ${root} on http://127.0.0.1:${port}`);
