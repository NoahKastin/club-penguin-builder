import { io } from 'socket.io-client';

const socket = io();

// Rejoin on reconnect
socket.on('connect', () => {
  if (pendingJoinData && ready) {
    socket.emit('join', pendingJoinData);
  }
});

const listeners = {
  roomState: [],
  penguinJoined: [],
  penguinLeft: [],
  penguinMoved: [],
  chatMessage: [],
  chatError: [],
  itemCollected: [],
  inventoryUpdated: [],
  penguinClothesChanged: [],
  hideEmojiUpdated: [],
  clubPenguinCreated: [],
  clubPenguinUpdated: [],
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

export function collectItem(data) {
  socket.emit('collectItem', data);
}

export function equipItem(inventoryIndex) {
  socket.emit('equipItem', inventoryIndex);
}

export function unequipItem(clothesIndex) {
  socket.emit('unequipItem', clothesIndex);
}

export function setHideEmoji(hide) {
  socket.emit('setHideEmoji', hide);
}

let storedToken = null;

export function setAuthToken(token) {
  storedToken = token;
}

export function createClubPenguin(data, callback) {
  socket.emit('createClubPenguin', { ...data, token: storedToken }, callback);
}

export function editClubPenguin(data, callback) {
  socket.emit('editClubPenguin', { ...data, token: storedToken }, callback);
}

// Join handshake: scene calls sceneReady() when create() finishes,
// GameView calls joinWhenReady() with the name and cpId.
// Join only fires when BOTH have happened.
let pendingJoinData = null;
let ready = false;

export function joinWhenReady(name, cpId, token) {
  pendingJoinData = { name, cpId, token };
  if (ready) {
    socket.emit('join', pendingJoinData);
  }
}

export function sceneReady() {
  ready = true;
  if (pendingJoinData) {
    socket.emit('join', pendingJoinData);
  }
}

// Called when the game is destroyed — resets handshake state
export function reset() {
  socket.emit('leaveCP');
  pendingJoinData = null;
  ready = false;
}
