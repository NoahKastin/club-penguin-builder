import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { getClubPenguin, createClubPenguin, updateClubPenguin, listClubPenguins } from './clubPenguins.js';
import {
  addPenguin,
  removePenguin,
  getPenguin,
  movePenguin,
  changePenguinRoom,
  getPenguinsInCPRoom,
  getPenguinCountForCP,
} from './state.js';

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
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

// Broadcast to all sockets whose penguin is in the given CP + room.
function cpSummary(cpId) {
  const cp = getClubPenguin(cpId);
  if (!cp) return null;
  return { id: cp.id, name: cp.name, roomCount: Object.keys(cp.rooms).length, penguinCount: getPenguinCountForCP(cpId) };
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

  socket.on('join', ({ name, cpId }) => {
    const cp = getClubPenguin(cpId);
    if (!cp) return;

    // If already in a CP, leave it first
    const existing = getPenguin(socket.id);
    if (existing) {
      broadcastToCPRoom(existing.cpId, existing.roomId, 'penguinLeft', { id: existing.id, name: existing.name }, socket.id);
      removePenguin(socket.id);
      io.emit('clubPenguinUpdated', cpSummary(existing.cpId));
    }

    const penguin = addPenguin(socket.id, name, cpId, cp.spawnRoom);

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
    // Validate
    if (!data.name || !data.name.trim()) {
      return callback({ success: false, error: 'Name is required' });
    }
    if (!data.rooms || Object.keys(data.rooms).length === 0) {
      return callback({ success: false, error: 'At least one room is required' });
    }

    const roomIds = Object.keys(data.rooms);
    const spawnRooms = roomIds.filter(k => data.rooms[k].spawn);
    if (spawnRooms.length !== 1) {
      return callback({ success: false, error: 'Exactly one room must be the spawn room' });
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

    const cp = createClubPenguin(data.name.trim(), data.rooms);
    const summary = cpSummary(cp.id);
    callback({ success: true, cp: summary });
    io.emit('clubPenguinCreated', summary);
  });

  socket.on('editClubPenguin', (data, callback) => {
    if (!data.id || !data.name || !data.name.trim()) {
      return callback({ success: false, error: 'Name is required' });
    }
    if (!data.rooms || Object.keys(data.rooms).length === 0) {
      return callback({ success: false, error: 'At least one room is required' });
    }

    const roomIds = Object.keys(data.rooms);
    const spawnRooms = roomIds.filter(k => data.rooms[k].spawn);
    if (spawnRooms.length !== 1) {
      return callback({ success: false, error: 'Exactly one room must be the spawn room' });
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

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
