import { createServer } from 'http';

const PORT = process.env.PORT || 3001;

// Start an HTTP server IMMEDIATELY so Fly.io proxy sees the port open.
// All real handling is wired up once the full app finishes loading.
let appHandler = (_req, res) => {
  res.writeHead(503, { 'Content-Type': 'text/plain' });
  res.end('Server starting...');
};

const server = createServer((req, res) => appHandler(req, res));

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Now load the heavy app module (express, socket.io, sqlite, etc.)
  import('./index.js').then(({ setup }) => {
    setup(server);
    console.log('App fully initialized');
  });
});
