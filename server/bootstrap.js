import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
const PORT = process.env.PORT || 3001;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

// Serve static files from dist/ while the full app loads.
// API and Socket.io requests get a loading response until ready.
let appReady = false;

function earlyHandler(req, res) {
  // API requests must wait for the full app
  if (req.url.startsWith('/api/') || req.url.startsWith('/socket.io/')) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server starting...' }));
    return;
  }

  // Try to serve static file from dist/
  let filePath = join(distDir, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(readFileSync(filePath));
    return;
  }

  // SPA fallback: serve index.html for any unknown path
  const indexPath = join(distDir, 'index.html');
  if (existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(readFileSync(indexPath));
    return;
  }

  res.writeHead(503, { 'Content-Type': 'text/plain' });
  res.end('Server starting...');
}

const server = createServer((req, res) => {
  if (!appReady) {
    earlyHandler(req, res);
  }
  // Once appReady, Express handles requests via the 'request' listener
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Now load the heavy app module (express, socket.io, sqlite, etc.)
  import('./index.js').then(({ setup }) => {
    setup(server);
    appReady = true;
    console.log('App fully initialized');
  });
});
