import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import geoip from 'fast-geoip';
import db from './db.js';
import { getClubPenguin, createClubPenguin, updateClubPenguin, listClubPenguins } from './clubPenguins.js';
import { createAccount, login, getAccount, createSession, getSession, deleteSession } from './accounts.js';
import { launchParty, getPartyLog } from './parties.js';
import { createCatalogItem, getCatalogItem, listCatalogItems, catalogItemExistsByName } from './catalog.js';
import { loadInventory, saveInventoryItem, setEquipped } from './inventory.js';
import { moderateUpload } from './moderation.js';
import {
  isStripeEnabled, getBundles, createCheckoutSession, handleWebhook,
  getBalance, getTransactions, purchaseItem, canAccessItem, getPurchasedItems,
  acquireFreeItem,
} from './payments.js';
import {
  addPenguin,
  removePenguin,
  getPenguin,
  movePenguin,
  addToInventory,
  equipItem,
  unequipItem,
  changePenguinRoom,
  getPenguinsInCPRoom,
  getPenguinCountForCP,
} from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BLOCKED_COUNTRIES = ['CA', 'GB'];

const app = express();

// Geo-restriction: block countries with active Club Penguin trademarks
app.use(async (req, res, next) => {
  const ip = req.headers['fly-client-ip'] || req.ip;
  try {
    const geo = await geoip.lookup(ip);
    if (geo && BLOCKED_COUNTRIES.includes(geo.country)) {
      return res.status(451).send('Club Penguin Builder is not available in your region due to trademark restrictions.');
    }
  } catch {}
  next();
});

// Stripe webhook needs raw body (must be before express.json)
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    handleWebhook(req.body, req.headers['stripe-signature']);
    res.json({ received: true });
  } catch (err) {
    console.warn('Stripe webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.use(express.json({ limit: '1mb' }));
app.use('/assets', express.static(join(__dirname, '..', 'dist', 'assets'), {
  maxAge: '1y',
  immutable: true,
}));
app.use(express.static(join(__dirname, '..', 'dist')));

let io;

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
  const row = db.prepare('SELECT sort_field, sort_dir, catalog_sort_field, catalog_sort_dir, inv_sort_field, inv_sort_dir FROM account_preferences WHERE account_id = ?').get(accountId);
  res.json(row || { sort_field: 'name', sort_dir: 'asc', catalog_sort_field: 'name', catalog_sort_dir: 'asc', inv_sort_field: 'name', inv_sort_dir: 'asc' });
});

app.put('/api/auth/preferences', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const { sort_field, sort_dir, catalog_sort_field, catalog_sort_dir, inv_sort_field, inv_sort_dir } = req.body;
  const validCpFields = ['name', 'createdAt', 'latestParty', 'penguinCount', 'roomCount'];
  const validItemFields = ['name', 'createdAt', 'attribution'];
  const validDirs = ['asc', 'desc'];

  // Validate whichever fields are provided
  if (sort_field !== undefined && (!validCpFields.includes(sort_field) || !validDirs.includes(sort_dir))) {
    return res.status(400).json({ error: 'Invalid sort options' });
  }
  if (catalog_sort_field !== undefined && (!validItemFields.includes(catalog_sort_field) || !validDirs.includes(catalog_sort_dir))) {
    return res.status(400).json({ error: 'Invalid catalog sort options' });
  }
  if (inv_sort_field !== undefined && (!validItemFields.includes(inv_sort_field) || !validDirs.includes(inv_sort_dir))) {
    return res.status(400).json({ error: 'Invalid inventory sort options' });
  }

  // Upsert all preference columns
  const existing = db.prepare('SELECT * FROM account_preferences WHERE account_id = ?').get(accountId);
  const merged = {
    sort_field: sort_field || (existing?.sort_field ?? 'name'),
    sort_dir: sort_dir || (existing?.sort_dir ?? 'asc'),
    catalog_sort_field: catalog_sort_field || (existing?.catalog_sort_field ?? 'name'),
    catalog_sort_dir: catalog_sort_dir || (existing?.catalog_sort_dir ?? 'asc'),
    inv_sort_field: inv_sort_field || (existing?.inv_sort_field ?? 'name'),
    inv_sort_dir: inv_sort_dir || (existing?.inv_sort_dir ?? 'asc'),
  };
  db.prepare(
    `INSERT INTO account_preferences (account_id, sort_field, sort_dir, catalog_sort_field, catalog_sort_dir, inv_sort_field, inv_sort_dir)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET sort_field = ?, sort_dir = ?, catalog_sort_field = ?, catalog_sort_dir = ?, inv_sort_field = ?, inv_sort_dir = ?`
  ).run(accountId, merged.sort_field, merged.sort_dir, merged.catalog_sort_field, merged.catalog_sort_dir, merged.inv_sort_field, merged.inv_sort_dir,
        merged.sort_field, merged.sort_dir, merged.catalog_sort_field, merged.catalog_sort_dir, merged.inv_sort_field, merged.inv_sort_dir);
  res.json(merged);
});

// Favorites
app.get('/api/auth/favorites', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const rows = db.prepare('SELECT catalog_id FROM account_favorites WHERE account_id = ?').all(accountId);
  res.json(rows.map(r => r.catalog_id));
});

app.put('/api/auth/favorites/:catalogId', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const { catalogId } = req.params;
  const existing = db.prepare('SELECT 1 FROM account_favorites WHERE account_id = ? AND catalog_id = ?').get(accountId, catalogId);
  if (existing) {
    db.prepare('DELETE FROM account_favorites WHERE account_id = ? AND catalog_id = ?').run(accountId, catalogId);
    res.json({ favorited: false });
  } else {
    db.prepare('INSERT INTO account_favorites (account_id, catalog_id) VALUES (?, ?)').run(accountId, catalogId);
    res.json({ favorited: true });
  }
});

// Config endpoint (public — frontend needs Stripe publishable key)
app.get('/api/config', (req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    stripeEnabled: isStripeEnabled(),
    bundles: getBundles(),
  });
});

// Pearl balance
app.get('/api/account/balance', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ pearls: getBalance(accountId) });
});

// Pearl transaction history
app.get('/api/account/transactions', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const txns = getTransactions(accountId).map(tx => {
    if ((tx.type === 'item_buy' || tx.type === 'item_sale') && tx.reference) {
      const item = getCatalogItem(tx.reference);
      if (item) tx.itemName = item.name;
    }
    return tx;
  });
  res.json(txns);
});

// Create Stripe checkout session for Pearl purchase
app.post('/api/payments/create-checkout', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });

  const { pearls } = req.body;
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const result = await createCheckoutSession(accountId, pearls, origin);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Purchase a priced catalog item with Pearls
app.post('/api/catalog/:id/purchase', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const result = purchaseItem(accountId, req.params.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true, pearls: getBalance(accountId) });
});

// Acquire a free catalog item (adds to user's library)
app.post('/api/catalog/:id/acquire', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'You must be logged in to acquire items' });
  const result = acquireFreeItem(accountId, req.params.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

// Check if user can access a priced item
app.get('/api/catalog/:id/access', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.json({ access: false });
  res.json({ access: canAccessItem(accountId, req.params.id) });
});

// Get all items user has purchased
app.get('/api/account/purchases', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  res.json(getPurchasedItems(accountId));
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

// Catalog endpoints
app.get('/api/catalog', (req, res) => {
  res.json(listCatalogItems());
});

app.get('/api/catalog/:id', (req, res) => {
  const item = getCatalogItem(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/api/catalog', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'You must be logged in to upload items' });

  // Check upload ban
  const banExpiry = uploadBans.get(accountId);
  if (banExpiry && Date.now() < banExpiry) {
    const hoursLeft = Math.ceil((banExpiry - Date.now()) / 3600000);
    return res.status(429).json({ error: `Upload access temporarily suspended. Try again in ${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}.` });
  }

  // Upload rate limit: 3 per hour
  const now = Date.now();
  const uploads = (uploadRateLimits.get(accountId) || []).filter(t => now - t < 3600000);
  if (uploads.length >= 3) {
    return res.status(429).json({ error: 'Upload limit reached (3 per hour). Please try again later.' });
  }

  const { name, image, attribution, price } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const itemPrice = Math.max(0, Math.floor(Number(price) || 0));
  if (!image || !image.startsWith('data:image/')) return res.status(400).json({ error: 'Image must be a data URL' });
  if (image.length > 128 * 1024) return res.status(400).json({ error: 'Image too large (max 128KB)' });
  if (catalogItemExistsByName(name.trim())) return res.status(409).json({ error: 'An item with that name already exists' });

  // Decode image to check pixel dimensions
  try {
    const base64Match = image.match(/^data:image\/\w+;base64,(.+)$/);
    if (base64Match) {
      const buf = Buffer.from(base64Match[1], 'base64');
      const dims = getImageDimensions(buf);
      if (dims && (dims.width > 800 || dims.height > 600)) {
        return res.status(400).json({ error: `Image dimensions too large (${dims.width}x${dims.height}). Maximum is 800x600.` });
      }
    }
  } catch (e) {
    // If we can't parse dimensions, allow it through
  }

  // AI moderation (runs after cheap checks, before creation)
  const modResult = await moderateUpload(image, name.trim());
  if (!modResult.ok) {
    // Track rejection for ban logic
    const rejections = (uploadRejections.get(accountId) || []).filter(t => now - t < 3600000);
    rejections.push(now);
    uploadRejections.set(accountId, rejections);
    if (rejections.length >= 3) {
      uploadBans.set(accountId, now + 86400000); // 24-hour ban
    }
    return res.status(400).json({ error: modResult.reason });
  }

  // Track successful upload for rate limiting
  uploads.push(now);
  uploadRateLimits.set(accountId, uploads);

  // Default attribution to uploader's username if not provided
  let attr = (attribution || '').trim();
  if (!attr) {
    const account = getAccount(accountId);
    if (account) attr = account.username;
  }

  const item = createCatalogItem(name.trim(), image, accountId, attr, itemPrice);
  res.json(item);
});

// Parse image dimensions from buffer (supports PNG and JPEG headers)
function getImageDimensions(buf) {
  // PNG: bytes 16-23 contain width and height as 4-byte big-endian integers
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: scan for SOF0/SOF2 markers
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let offset = 2;
    while (offset < buf.length - 8) {
      if (buf[offset] !== 0xFF) break;
      const marker = buf[offset + 1];
      if (marker === 0xC0 || marker === 0xC2) {
        return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
      }
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  }
  // GIF: bytes 6-9 contain width and height as 2-byte little-endian integers
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  return null;
}

// Broadcast to all sockets whose penguin is in the given CP + room.
function cpSummary(cpId) {
  const cp = getClubPenguin(cpId);
  if (!cp) return null;
  return { id: cp.id, name: cp.name, roomCount: Object.keys(cp.rooms).length, penguinCount: getPenguinCountForCP(cpId), creatorId: cp.creatorId || null };
}

// Resolve catalog item images for a room's items
function resolveCatalogItems(room) {
  if (!room.items || room.items.length === 0) return {};
  const catalogItems = {};
  for (const item of room.items) {
    if (!catalogItems[item.catalogId]) {
      const catItem = getCatalogItem(item.catalogId);
      if (catItem) {
        catalogItems[item.catalogId] = { name: catItem.name, image: catItem.image };
      }
    }
  }
  return catalogItems;
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

// Upload rate limiting: per-account tracking
const uploadRateLimits = new Map(); // accountId → [timestamps]
const uploadRejections = new Map(); // accountId → [timestamps]
const uploadBans = new Map(); // accountId → ban expiry timestamp

// Chat rate limiting: per-socket tracking
const chatRateLimits = new Map();

function wireSocketEvents() {
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);
  chatRateLimits.set(socket.id, []);

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

    // Validate name length
    if (!name || name.length < 1 || name.length > 20) return;

    // If already in a CP, leave it first
    const existing = getPenguin(socket.id);
    if (existing) {
      broadcastToCPRoom(existing.cpId, existing.roomId, 'penguinLeft', { id: existing.id, name: existing.name }, socket.id);
      removePenguin(socket.id);
      io.emit('clubPenguinUpdated', cpSummary(existing.cpId));
    }

    const visibleRooms = Object.keys(cp.rooms).filter(k => !cp.rooms[k].hidden);
    const spawnRoom = visibleRooms.length > 0
      ? visibleRooms[Math.floor(Math.random() * visibleRooms.length)]
      : cp.spawnRoom;
    const penguin = addPenguin(socket.id, name, cpId, spawnRoom, accountId);

    // Restore saved inventory for logged-in users
    if (accountId) {
      const saved = loadInventory(accountId);
      for (const item of saved) {
        penguin.inventory.push(item);
        if (item.equipped) {
          penguin.clothes.push(item);
        }
      }
    }

    const room = cp.rooms[penguin.roomId];
    socket.emit('roomState', {
      room,
      penguins: getPenguinsInCPRoom(cpId, penguin.roomId),
      you: penguin.id,
      catalogItems: resolveCatalogItems(room),
      inventory: penguin.inventory,
      clothes: penguin.clothes,
    });

    broadcastToCPRoom(cpId, penguin.roomId, 'penguinJoined', penguin, socket.id);
    io.emit('clubPenguinUpdated', cpSummary(cpId));
  });

  socket.on('move', ({ x, y }) => {
    // Clamp to room bounds
    x = Math.max(0, Math.min(800, x));
    y = Math.max(0, Math.min(600, y));
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
    if (!penguin) return;

    // Rate limit: max 5 messages per 3 seconds
    const now = Date.now();
    const times = chatRateLimits.get(socket.id) || [];
    const recent = times.filter(t => now - t < 3000);
    if (recent.length >= 5) {
      socket.emit('chatError', 'Slow down! Too many messages.');
      return;
    }
    recent.push(now);
    chatRateLimits.set(socket.id, recent);

    broadcastToCPRoom(penguin.cpId, penguin.roomId, 'chatMessage', {
      id: penguin.id,
      name: penguin.name,
      message,
    });
  });

  socket.on('changeRoom', (roomId) => {
    const penguin = getPenguin(socket.id);
    if (!penguin) return;

    const cp = getClubPenguin(penguin.cpId);
    if (!cp || !cp.rooms[roomId]) return;

    const oldRoom = penguin.roomId;

    broadcastToCPRoom(penguin.cpId, oldRoom, 'penguinLeft', { id: penguin.id, name: penguin.name }, socket.id);

    changePenguinRoom(socket.id, roomId);

    const newRoom = cp.rooms[roomId];
    socket.emit('roomState', {
      room: newRoom,
      penguins: getPenguinsInCPRoom(penguin.cpId, roomId),
      you: penguin.id,
      catalogItems: resolveCatalogItems(newRoom),
    });

    broadcastToCPRoom(penguin.cpId, roomId, 'penguinJoined', penguin, socket.id);
  });

  socket.on('collectItem', ({ catalogId, wearOffsetX, wearOffsetY, wearWidth, wearHeight }) => {
    const penguin = getPenguin(socket.id);
    if (!penguin) return;

    const catItem = getCatalogItem(catalogId);
    if (!catItem) return;

    const inventoryEntry = {
      catalogId,
      name: catItem.name,
      image: catItem.image,
      wearOffsetX: wearOffsetX || 0,
      wearOffsetY: wearOffsetY || 0,
      wearWidth: wearWidth || 40,
      wearHeight: wearHeight || 40,
      attribution: catItem.attribution || '',
    };

    addToInventory(socket.id, inventoryEntry);

    // Persist for logged-in users
    if (penguin.accountId) {
      saveInventoryItem(penguin.accountId, inventoryEntry);
    }

    socket.emit('itemCollected', { item: inventoryEntry, inventory: penguin.inventory });
  });

  socket.on('equipItem', (inventoryIndex) => {
    const penguin = getPenguin(socket.id);
    if (!penguin) return;

    equipItem(socket.id, inventoryIndex);

    // Persist equipped state for logged-in users
    if (penguin.accountId && inventoryIndex < penguin.inventory.length) {
      const item = penguin.inventory[inventoryIndex];
      setEquipped(penguin.accountId, item.catalogId, item.wearOffsetX, item.wearOffsetY, item.wearWidth, item.wearHeight, true);
    }

    socket.emit('inventoryUpdated', { inventory: penguin.inventory, clothes: penguin.clothes });
    broadcastToCPRoom(penguin.cpId, penguin.roomId, 'penguinClothesChanged', {
      id: penguin.id,
      clothes: penguin.clothes,
    });
  });

  socket.on('unequipItem', (clothesIndex) => {
    const penguin = getPenguin(socket.id);
    if (!penguin) return;

    // Get item info before unequipping
    const item = clothesIndex < penguin.clothes.length ? penguin.clothes[clothesIndex] : null;

    unequipItem(socket.id, clothesIndex);

    // Persist equipped state for logged-in users
    if (penguin.accountId && item) {
      setEquipped(penguin.accountId, item.catalogId, item.wearOffsetX, item.wearOffsetY, item.wearWidth, item.wearHeight, false);
    }

    socket.emit('inventoryUpdated', { inventory: penguin.inventory, clothes: penguin.clothes });
    broadcastToCPRoom(penguin.cpId, penguin.roomId, 'penguinClothesChanged', {
      id: penguin.id,
      clothes: penguin.clothes,
    });
  });

  function validateItemAccess(rooms, accountId) {
    for (const room of Object.values(rooms)) {
      for (const item of (room.items || [])) {
        if (item.catalogId && !canAccessItem(accountId, item.catalogId)) {
          const cat = getCatalogItem(item.catalogId);
          const label = cat ? `"${cat.name}"` : item.catalogId;
          return `You don't have access to item ${label} — acquire it from the Catalog first`;
        }
      }
    }
    return null;
  }

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

    const itemError = validateItemAccess(data.rooms, creatorAccountId);
    if (itemError) return callback({ success: false, error: itemError });

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

    const itemError = validateItemAccess(data.rooms, editorAccountId);
    if (itemError) return callback({ success: false, error: itemError });

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
    chatRateLimits.delete(socket.id);
    console.log(`Disconnected: ${socket.id}`);
  });
});
} // end wireSocketEvents

// Catch-all: serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
});

// Called by bootstrap.js once the HTTP server is already listening
export function setup(httpServer) {
  // Attach Express as the request handler
  httpServer.removeAllListeners('request');
  httpServer.on('request', app);

  // Attach Socket.io
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Wire up socket events
  wireSocketEvents();
}

// Standalone mode (npm run dev)
if (!process.env.FLY_APP_NAME) {
  const httpServer = createServer(app);
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });
  wireSocketEvents();
  const PORT = process.env.PORT || 3001;
  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
