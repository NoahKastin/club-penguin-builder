import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ROOMS } from './rooms.js';
import {
  addPenguin,
  removePenguin,
  getPenguin,
  movePenguin,
  changePenguinRoom,
  getPenguinsInRoom,
} from './state.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Broadcast to all sockets whose penguin is in the given room.
// Uses our own state instead of Socket.io rooms for reliability.
function broadcastToRoom(roomId, event, data, excludeSocketId = null) {
  for (const [id, s] of io.sockets.sockets) {
    if (id === excludeSocketId) continue;
    const p = getPenguin(id);
    if (p && p.roomId === roomId) {
      s.emit(event, data);
    }
  }
}

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('join', (name) => {
    const penguin = addPenguin(socket.id, name);

    // Send room data and current penguins to the joining player
    socket.emit('roomState', {
      room: ROOMS[penguin.roomId],
      penguins: getPenguinsInRoom(penguin.roomId),
      you: penguin.id,
    });

    // Tell others in the room about the new penguin
    broadcastToRoom(penguin.roomId, 'penguinJoined', penguin, socket.id);
  });

  socket.on('move', ({ x, y }) => {
    const penguin = movePenguin(socket.id, x, y);
    if (penguin) {
      broadcastToRoom(penguin.roomId, 'penguinMoved', {
        id: penguin.id,
        x,
        y,
      }, socket.id);
    }
  });

  socket.on('chat', (message) => {
    const penguin = getPenguin(socket.id);
    if (penguin) {
      // Send to ALL in the room, including sender
      broadcastToRoom(penguin.roomId, 'chatMessage', {
        id: penguin.id,
        name: penguin.name,
        message,
      });
    }
  });

  socket.on('changeRoom', (roomId) => {
    if (!ROOMS[roomId]) return;

    const penguin = getPenguin(socket.id);
    if (!penguin) return;

    const oldRoom = penguin.roomId;

    // Notify old room
    broadcastToRoom(oldRoom, 'penguinLeft', { id: penguin.id }, socket.id);

    // Move penguin to new room
    changePenguinRoom(socket.id, roomId);

    // Send new room state to the player
    socket.emit('roomState', {
      room: ROOMS[roomId],
      penguins: getPenguinsInRoom(roomId),
      you: penguin.id,
    });

    // Notify new room
    broadcastToRoom(roomId, 'penguinJoined', penguin, socket.id);
  });

  socket.on('disconnect', () => {
    const penguin = removePenguin(socket.id);
    if (penguin) {
      broadcastToRoom(penguin.roomId, 'penguinLeft', { id: penguin.id });
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
