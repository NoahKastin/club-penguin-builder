import { io } from 'socket.io-client';

const socket = io();

const listeners = {
  roomState: [],
  penguinJoined: [],
  penguinLeft: [],
  penguinMoved: [],
  chatMessage: [],
};

// Register server event forwarding
for (const event of Object.keys(listeners)) {
  socket.on(event, (data) => {
    for (const cb of listeners[event]) {
      cb(data);
    }
  });
}

export function on(event, callback) {
  if (listeners[event]) {
    listeners[event].push(callback);
  }
}

export function off(event, callback) {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter((cb) => cb !== callback);
  }
}

export function move(x, y) {
  socket.emit('move', { x, y });
}

export function chat(message) {
  socket.emit('chat', message);
}

export function changeRoom(roomId) {
  socket.emit('changeRoom', roomId);
}

// Join handshake: scene calls sceneReady() when create() finishes,
// GameView calls joinWhenReady() with the name.
// Join only fires when BOTH have happened.
let pendingName = null;
let ready = false;

export function joinWhenReady(name) {
  pendingName = name;
  if (ready) {
    socket.emit('join', name);
  }
}

export function sceneReady() {
  ready = true;
  if (pendingName) {
    socket.emit('join', pendingName);
  }
}

// Called when the game is destroyed — resets handshake state
export function reset() {
  pendingName = null;
  ready = false;
}
