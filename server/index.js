import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import geoip from 'geoip-lite';
import db from './db.js';
import { getClubPenguin, createClubPenguin, updateClubPenguin, listClubPenguins } from './clubPenguins.js';
import { createAccount, login, getAccount, createSession, getSession, deleteSession } from './accounts.js';
import { launchParty, getPartyLog } from './parties.js';
import {
  addPenguin,
  removePenguin,
  getPenguin,
  movePenguin,
  changePenguinRoom,
  getPenguinsInCPRoom,
  getPenguinCountForCP,
} from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BLOCKED_COUNTRIES = ['CA', 'GB'];

const app = express();

// Geo-restriction: block countries with active Club Penguin trademarks
app.use((req, res, next) => {
  const ip = req.headers['fly-client-ip'] || req.ip;
  const geo = geoip.lookup(ip);
  if (geo && BLOCKED_COUNTRIES.includes(geo.country)) {
    return res.status(451).send('Club Penguin Builder is not available in your region due to trademark restrictions.');
  }
  next();
});

app.use(express.json());
app.use('/assets', express.static(join(__dirname, '..', 'dist', 'assets'), {
  maxAge: '1y',
  immutable: true,
}));
app.use(express.static(join(__dirname, '..', 'dist')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !/^[a-zA-Z0-9_]{1,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 1-20 alphanumeric characters or underscores' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const account = await createAccount(username, password);
  if (!account) {
    return res.status(409).json({ error: 'Username already taken' });
  }
  const token = createSession(account.id);
  res.json({ token, account });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const account = await login(username, password);
  if (!account) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = createSession(account.id);
  res.json({ token, account });
});

app.post('/api/auth/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token) deleteSession(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const account = getAccount(accountId);
  if (!account) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ account });
});

// Sort preferences
app.get('/api/auth/preferences', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const row = db.prepare('SELECT sort_field, sort_dir FROM account_preferences WHERE account_id = ?').get(accountId);
  res.json(row || { sort_field: 'name', sort_dir: 'asc' });
});

app.put('/api/auth/preferences', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const { sort_field, sort_dir } = req.body;
  const validFields = ['name', 'createdAt', 'latestParty', 'penguinCount', 'roomCount'];
  const validDirs = ['asc', 'desc'];
  if (!validFields.includes(sort_field) || !validDirs.includes(sort_dir)) {
    return res.status(400).json({ error: 'Invalid sort options' });
  }
  db.prepare('INSERT INTO account_preferences (account_id, sort_field, sort_dir) VALUES (?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET sort_field = ?, sort_dir = ?').run(accountId, sort_field, sort_dir, sort_field, sort_dir);
  res.json({ sort_field, sort_dir });
});

// REST endpoint for listing Club Penguins
app.get('/api/clubpenguins', (req, res) => {
  res.json(listClubPenguins());
});

app.get('/api/clubpenguins/:id', (req, res) => {
  const cp = getClubPenguin(req.params.id);
  if (!cp) return res.status(404).json({ error: 'Not found' });
  res.json(cp);
});

app.get('/api/clubpenguins/:id/parties', (req, res) => {
  const cp = getClubPenguin(req.params.id);
  if (!cp) return res.status(404).json({ error: 'Not found' });
  res.json(getPartyLog(req.params.id));
});

// Broadcast to all sockets whose penguin is in the given CP + room.
function cpSummary(cpId) {
  const cp = getClubPenguin(cpId);
  if (!cp) return null;
  return { id: cp.id, name: cp.name, roomCount: Object.keys(cp.rooms).length, penguinCount: getPenguinCountForCP(cpId), creatorId: cp.creatorId || null };
}

function broadcastToCPRoom(cpId, roomId, event, data, excludeSocketId = null) {
  for (const [id, s] of io.sockets.sockets) {
    if (id === excludeSocketId) continue;
    const p = getPenguin(id);
    if (p && p.cpId === cpId && p.roomId === roomId) {
      s.emit(event, data);
    }
  }
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('join', ({ name, cpId, token }) => {
    const cp = getClubPenguin(cpId);
    if (!cp) return;

    // If authenticated, use account username
    let accountId = null;
    if (token) {
      accountId = getSession(token);
      if (accountId) {
        const account = getAccount(accountId);
        if (account) name = account.username;
      }
    }

    // If already in a CP, leave it first
    const existing = getPenguin(socket.id);
    if (existing) {
      broadcastToCPRoom(existing.cpId, existing.roomId, 'penguinLeft', { id: existing.id, name: existing.name }, socket.id);
      removePenguin(socket.id);
      io.emit('clubPenguinUpdated', cpSummary(existing.cpId));
    }

    const penguin = addPenguin(socket.id, name, cpId, cp.spawnRoom, accountId);

    socket.emit('roomState', {
      room: cp.rooms[penguin.roomId],
      penguins: getPenguinsInCPRoom(cpId, penguin.roomId),
      you: penguin.id,
    });

    broadcastToCPRoom(cpId, penguin.roomId, 'penguinJoined', penguin, socket.id);
    io.emit('clubPenguinUpdated', cpSummary(cpId));
  });

  socket.on('move', ({ x, y }) => {
    const penguin = movePenguin(socket.id, x, y);
    if (penguin) {
      broadcastToCPRoom(penguin.cpId, penguin.roomId, 'penguinMoved', {
        id: penguin.id,
        x,
        y,
      }, socket.id);
    }
  });

  socket.on('chat', (message) => {
    const penguin = getPenguin(socket.id);
    if (penguin) {
      broadcastToCPRoom(penguin.cpId, penguin.roomId, 'chatMessage', {
        id: penguin.id,
        name: penguin.name,
        message,
      });
    }
  });

  socket.on('changeRoom', (roomId) => {
    const penguin = getPenguin(socket.id);
    if (!penguin) return;

    const cp = getClubPenguin(penguin.cpId);
    if (!cp || !cp.rooms[roomId]) return;

    const oldRoom = penguin.roomId;

    broadcastToCPRoom(penguin.cpId, oldRoom, 'penguinLeft', { id: penguin.id, name: penguin.name }, socket.id);

    changePenguinRoom(socket.id, roomId);

    socket.emit('roomState', {
      room: cp.rooms[roomId],
      penguins: getPenguinsInCPRoom(penguin.cpId, roomId),
      you: penguin.id,
    });

    broadcastToCPRoom(penguin.cpId, roomId, 'penguinJoined', penguin, socket.id);
  });

  socket.on('createClubPenguin', (data, callback) => {
    // Auth check: must be logged in
    const creatorAccountId = data.token ? getSession(data.token) : null;
    if (!creatorAccountId) {
      return callback({ success: false, error: 'You must be logged in to create a Club Penguin' });
    }

    // Validate
    if (!data.name || !data.name.trim()) {
      return callback({ success: false, error: 'Name is required' });
    }
    if (!data.rooms || Object.keys(data.rooms).length === 0) {
      return callback({ success: false, error: 'At least one room is required' });
    }

    const roomIds = Object.keys(data.rooms);
    if (roomIds.every(k => data.rooms[k].hidden)) {
      return callback({ success: false, error: 'At least one room must not be hidden' });
    }

    // Validate exit targets
    for (const roomId of roomIds) {
      const room = data.rooms[roomId];
      if (room.exits) {
        for (const exit of room.exits) {
          if (!roomIds.includes(exit.targetRoom)) {
            return callback({ success: false, error: `Exit target "${exit.targetRoom}" does not exist` });
          }
        }
      }
    }

    const cp = createClubPenguin(data.name.trim(), data.rooms, creatorAccountId);
    const summary = cpSummary(cp.id);
    callback({ success: true, cp: summary });
    io.emit('clubPenguinCreated', summary);
  });

  socket.on('editClubPenguin', (data, callback) => {
    // Auth check: must be logged in and be the creator
    const editorAccountId = data.token ? getSession(data.token) : null;
    if (!editorAccountId) {
      return callback({ success: false, error: 'You must be logged in to throw a party' });
    }
    const existingCp = getClubPenguin(data.id);
    if (existingCp && existingCp.creatorId && existingCp.creatorId !== editorAccountId) {
      return callback({ success: false, error: 'You can only edit Club Penguins you created' });
    }

    if (!data.id || !data.name || !data.name.trim()) {
      return callback({ success: false, error: 'Name is required' });
    }
    if (!data.rooms || Object.keys(data.rooms).length === 0) {
      return callback({ success: false, error: 'At least one room is required' });
    }

    const roomIds = Object.keys(data.rooms);
    if (roomIds.every(k => data.rooms[k].hidden)) {
      return callback({ success: false, error: 'At least one room must not be hidden' });
    }

    for (const roomId of roomIds) {
      const room = data.rooms[roomId];
      if (room.exits) {
        for (const exit of room.exits) {
          if (!roomIds.includes(exit.targetRoom)) {
            return callback({ success: false, error: `Exit target "${exit.targetRoom}" does not exist` });
          }
        }
      }
    }

    const cp = updateClubPenguin(data.id, data.name.trim(), data.rooms);
    if (!cp) {
      return callback({ success: false, error: 'Club Penguin not found' });
    }
    const summary = cpSummary(cp.id);
    if (data.partyName && data.partyName.trim()) {
      launchParty(data.id, data.partyName.trim());
    }
    callback({ success: true, cp: summary });
    io.emit('clubPenguinUpdated', summary);
  });

  socket.on('leaveCP', () => {
    const penguin = removePenguin(socket.id);
    if (penguin) {
      broadcastToCPRoom(penguin.cpId, penguin.roomId, 'penguinLeft', { id: penguin.id, name: penguin.name });
      io.emit('clubPenguinUpdated', cpSummary(penguin.cpId));
    }
  });

  socket.on('disconnect', () => {
    const penguin = removePenguin(socket.id);
    if (penguin) {
      broadcastToCPRoom(penguin.cpId, penguin.roomId, 'penguinLeft', { id: penguin.id, name: penguin.name });
      io.emit('clubPenguinUpdated', cpSummary(penguin.cpId));
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

// Catch-all: serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
