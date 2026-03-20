import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import geoip from 'fast-geoip';
import { adjustMoveTarget, lineRectIntersection, simulateSkid, simulateGravity } from '../shared/collision.js';
import db from './db.js';
import { getClubPenguin, createClubPenguin, updateClubPenguin, updateRoomItemPosition, listClubPenguins } from './clubPenguins.js';
import { createAccount, login, getAccount, createSession, getSession, deleteSession, updateAttributionName } from './accounts.js';
import { launchParty, getPartyLog } from './parties.js';
import { createCatalogItem, getCatalogItem, listCatalogItems, catalogItemExistsByName } from './catalog.js';
import { createGame, getGame, listGames, gameExistsByName } from './games.js';
import { loadInventory, saveInventoryItem, setEquipped } from './inventory.js';
import { moderateUpload } from './moderation.js';
import { trackStart, getStats, getCPStats, resetStats } from './stats.js';
import {
  isStripeEnabled, getBundles, createCheckoutSession, handleWebhook,
  getBalance, getTransactions, purchaseItem, canAccessItem, getPurchasedItems,
  acquireFreeItem, createConnectAccount, createOnboardingLink, getConnectStatus, cashOut,
  purchaseGame, canAccessGame, acquireFreeGame, getPurchasedGames,
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
  startDrag,
  moveDragItem,
  stopDrag,
  getDragOverrides,
  clearDragLocks,
  setItemPosition,
} from './state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BLOCKED_COUNTRIES = ['CA', 'GB'];

const app = express();

// Geo-restriction: block countries with active Club Penguin trademarks
app.use(async (req, res, next) => {
  const done = trackStart('middleware:geoip');
  const ip = req.headers['fly-client-ip'] || req.ip;
  try {
    const geo = await geoip.lookup(ip);
    if (geo && BLOCKED_COUNTRIES.includes(geo.country)) {
      done();
      return res.status(451).send('Club Penguin Builder is not available in your region due to trademark restrictions.');
    }
  } catch {}
  done();
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

// Track all HTTP requests (lightweight — just count + time)
app.use((req, res, next) => {
  const done = trackStart('http:all');
  res.on('finish', done);
  next();
});

// CPU/time stats endpoint (sorted by total time descending)
app.get('/api/admin/stats', (req, res) => {
  const raw = getStats();
  const sorted = Object.entries(raw)
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .map(([name, s]) => ({ operation: name, ...s }));
  const uptime = Math.round(process.uptime());
  const mem = process.memoryUsage();
  // Per-CP breakdown sorted by total time, with names
  const rawCP = getCPStats();
  const cpBreakdown = Object.entries(rawCP)
    .sort((a, b) => b[1].totalMs - a[1].totalMs)
    .map(([cpId, data]) => {
      const cp = getClubPenguin(cpId);
      return { cpId, name: cp ? cp.name : '(deleted)', ...data };
    });

  res.json({
    uptimeSeconds: uptime,
    memoryMB: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
    operations: sorted,
    clubPenguins: cpBreakdown,
  });
});

app.post('/api/admin/stats/reset', (req, res) => {
  resetStats();
  res.json({ ok: true });
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

// Update attribution name
app.put('/api/auth/attribution-name', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const { attributionName } = req.body;
  if (typeof attributionName !== 'string' || attributionName.length > 60) {
    return res.status(400).json({ error: 'Attribution name must be 60 characters or fewer' });
  }
  updateAttributionName(accountId, attributionName.trim());
  res.json({ ok: true });
});

// Sort preferences
app.get('/api/auth/preferences', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const row = db.prepare('SELECT sort_field, sort_dir, catalog_sort_field, catalog_sort_dir, inv_sort_field, inv_sort_dir, hide_emoji FROM account_preferences WHERE account_id = ?').get(accountId);
  res.json(row || { sort_field: 'name', sort_dir: 'asc', catalog_sort_field: 'name', catalog_sort_dir: 'asc', inv_sort_field: 'name', inv_sort_dir: 'asc', hide_emoji: 0 });
});

app.put('/api/auth/preferences', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });
  const { sort_field, sort_dir, catalog_sort_field, catalog_sort_dir, inv_sort_field, inv_sort_dir, hide_emoji } = req.body;
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
    hide_emoji: hide_emoji !== undefined ? (hide_emoji ? 1 : 0) : (existing?.hide_emoji ?? 0),
  };
  db.prepare(
    `INSERT INTO account_preferences (account_id, sort_field, sort_dir, catalog_sort_field, catalog_sort_dir, inv_sort_field, inv_sort_dir, hide_emoji)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET sort_field = ?, sort_dir = ?, catalog_sort_field = ?, catalog_sort_dir = ?, inv_sort_field = ?, inv_sort_dir = ?, hide_emoji = ?`
  ).run(accountId, merged.sort_field, merged.sort_dir, merged.catalog_sort_field, merged.catalog_sort_dir, merged.inv_sort_field, merged.inv_sort_dir, merged.hide_emoji,
        merged.sort_field, merged.sort_dir, merged.catalog_sort_field, merged.catalog_sort_dir, merged.inv_sort_field, merged.inv_sort_dir, merged.hide_emoji);
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

// Stripe Connect — seller cash-out
app.post('/api/connect/setup', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    await createConnectAccount(accountId);
    const origin = `${req.protocol}://${req.get('host')}`;
    const { url } = await createOnboardingLink(accountId, origin);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/connect/status', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const status = await getConnectStatus(accountId);
    res.json(status);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/connect/cashout', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });

  const { pearls } = req.body;
  try {
    const result = await cashOut(accountId, pearls);
    res.json({ ...result, balance: getBalance(accountId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/connect/onboarding-link', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const { url } = await createOnboardingLink(accountId, origin);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
  const done = trackStart('http:POST /api/catalog');
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = getSession(token);
  if (!accountId) { done(); return res.status(401).json({ error: 'You must be logged in to upload items' }); }

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
  let imgWidth = null, imgHeight = null;
  try {
    const base64Match = image.match(/^data:image\/\w+;base64,(.+)$/);
    if (base64Match) {
      const buf = Buffer.from(base64Match[1], 'base64');
      const dims = getImageDimensions(buf);
      if (dims) {
        imgWidth = dims.width;
        imgHeight = dims.height;
        if (dims.width > 800 || dims.height > 600) {
          return res.status(400).json({ error: `Image dimensions too large (${dims.width}x${dims.height}). Maximum is 800x600.` });
        }
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

  // Default attribution to account's attribution_name, then username
  let attr = (attribution || '').trim();
  if (!attr) {
    const account = getAccount(accountId);
    if (account) attr = account.attribution_name || account.username;
  }

  const item = createCatalogItem(name.trim(), image, accountId, attr, itemPrice, imgWidth, imgHeight);
  done();
  res.json(item);
});

// Game endpoints
app.get('/api/games', (req, res) => {
  res.json(listGames());
});

app.get('/api/games/:id', (req, res) => {
  const game = getGame(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  res.json(game);
});

app.post('/api/games/upload', express.json({ limit: '50kb' }), (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = token ? getSession(token) : null;
  if (!accountId) return res.status(401).json({ error: 'Login required' });

  const { name, items, width, height, gravityDirection, price, attribution: clientAttribution } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Game must have at least one item' });
  if (!width || !height || width <= 0 || height <= 0) return res.status(400).json({ error: 'Invalid game dimensions' });

  if (gameExistsByName(name.trim())) return res.status(400).json({ error: 'A game with that name already exists' });

  // Validate all items use creator's own uploads
  for (const item of items) {
    const catItem = getCatalogItem(item.catalogId);
    if (!catItem) return res.status(400).json({ error: `Item ${item.catalogId} not found in catalog` });
    if (catItem.uploaderId !== accountId) return res.status(400).json({ error: `Item "${catItem.name}" was uploaded by someone else — games can only use your own uploads` });
  }

  const account = getAccount(accountId);
  const attribution = (clientAttribution && clientAttribution.trim()) || account?.attribution_name || account?.username || '';
  const game = createGame(name.trim(), items, width, height, gravityDirection || null, accountId, attribution, price || 0);
  res.json({ success: true, game });
});

app.post('/api/games/:id/purchase', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = token ? getSession(token) : null;
  if (!accountId) return res.status(401).json({ error: 'Login required' });
  const result = purchaseGame(accountId, req.params.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ success: true, pearls: getBalance(accountId) });
});

app.post('/api/games/:id/acquire', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = token ? getSession(token) : null;
  if (!accountId) return res.status(401).json({ error: 'Login required' });
  const result = acquireFreeGame(accountId, req.params.id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

app.get('/api/games/:id/access', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = token ? getSession(token) : null;
  if (!accountId) return res.json({ access: false });
  res.json({ access: canAccessGame(accountId, req.params.id) });
});

app.get('/api/account/game-purchases', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const accountId = token ? getSession(token) : null;
  if (!accountId) return res.status(401).json({ error: 'Login required' });
  res.json(getPurchasedGames(accountId));
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

// Transform a point from screen space to game-local space (un-rotate around game center, shift to 0-origin)
function toLocalSpace(x, y, gb) {
  const gcx = gb.x + gb.w / 2;
  const gcy = gb.y + gb.h / 2;
  const rot = -(gb.rotation || 0) * Math.PI / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const dx = x - gcx;
  const dy = y - gcy;
  return { x: dx * cos - dy * sin + gb.w / 2, y: dx * sin + dy * cos + gb.h / 2 };
}

// Transform a point from game-local space back to screen space
function toScreenSpace(x, y, gb) {
  const gcx = gb.x + gb.w / 2;
  const gcy = gb.y + gb.h / 2;
  const rot = (gb.rotation || 0) * Math.PI / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const dx = x - gb.w / 2;
  const dy = y - gb.h / 2;
  return { x: gcx + dx * cos - dy * sin, y: gcy + dx * sin + dy * cos };
}

// Expand game entries in a room's items array into individual items.
// Each game entry becomes N items with gameGroup, scaled/translated to the game's placement rect.
// Returns a new items array with games expanded, plus a mapping for catalog resolution.
function expandRoomItems(room) {
  if (!room.items || room.items.length === 0) return [];
  const expanded = [];
  for (const item of room.items) {
    if (item.gameId) {
      const game = getGame(item.gameId);
      if (!game) continue;
      const sx = item.width / game.width;
      const sy = item.height / game.height;
      const gameRot = (item.rotation || 0) * Math.PI / 180;
      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      // Unique group key per placement (same game placed twice = two groups)
      const groupKey = item.gameId + ':' + expanded.length;
      for (const gi of game.items) {
        // Position relative to game center (before rotation)
        let ex = item.x + gi.x * sx + gi.width * sx / 2 - cx;
        let ey = item.y + gi.y * sy + gi.height * sy / 2 - cy;
        // Apply rotation around game center
        let fx, fy;
        if (gameRot) {
          const cos = Math.cos(gameRot);
          const sin = Math.sin(gameRot);
          fx = cx + ex * cos - ey * sin;
          fy = cy + ex * sin + ey * cos;
        } else {
          fx = cx + ex;
          fy = cy + ey;
        }
        // Convert back from center to top-left
        const ew = gi.width * sx;
        const eh = gi.height * sy;
        expanded.push({
          ...gi,
          x: fx - ew / 2,
          y: fy - eh / 2,
          width: ew,
          height: eh,
          rotation: (gi.rotation || 0) + (item.rotation || 0),
          gameGroup: groupKey,
          gameBounds: { x: item.x, y: item.y, w: item.width, h: item.height, rotation: item.rotation || 0 },
          gameGravityDirection: game.gravityDirection,
        });
      }
    } else {
      expanded.push(item);
    }
  }
  return expanded;
}

// Resolve catalog item images for a room's items (including expanded game items)
function resolveCatalogItems(room, expandedItems) {
  const items = expandedItems || room.items || [];
  if (items.length === 0) return {};
  const catalogItems = {};
  for (const item of items) {
    if (item.catalogId && !catalogItems[item.catalogId]) {
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

// Resolve current item positions for a room (accounting for drag overrides)
// Uses expanded items (games already exploded into individual items).
function resolveRoomItems(room, cpId, roomId) {
  const dragOverrides = getDragOverrides(cpId, roomId);
  return room.items.map((i, idx) => {
    const ov = dragOverrides && dragOverrides[idx];
    return {
      x: (ov && ov.x != null) ? ov.x : i.x,
      y: (ov && ov.y != null) ? ov.y : i.y,
      w: i.width, h: i.height,
      blocksMovement: i.blocksMovement,
      skid: i.skid,
      gravity: i.gravity,
      behavior: i.behavior,
      gameGroup: i.gameGroup || null,
      gameBounds: i.gameBounds || null,
      gameGravityDirection: i.gameGravityDirection || null,
      idx,
    };
  });
}

// Settle all gravity items in a room. Sorts by proximity to gravity floor
// so items stack correctly. Groups by gameGroup for scoped physics.
function settleGravityItems(cpId, roomId, room) {
  const resolved = resolveRoomItems(room, cpId, roomId);
  const gravityItems = resolved.filter(i => i.gravity);
  if (gravityItems.length === 0) return [];

  // Group items by gameGroup (null = room-level items)
  const groups = new Map();
  for (const item of gravityItems) {
    const key = item.gameGroup || '__room__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const events = [];

  for (const [groupKey, items] of groups) {
    // Determine gravity direction and bounds for this group
    const isGame = groupKey !== '__room__';
    const direction = isGame ? (items[0].gameGravityDirection || 'down') : (room.gravityDirection || 'down');
    const boundsX = isGame && items[0].gameBounds ? items[0].gameBounds.x : 0;
    const boundsY = isGame && items[0].gameBounds ? items[0].gameBounds.y : 0;
    const boundsW = isGame && items[0].gameBounds ? items[0].gameBounds.w : 800;
    const boundsH = isGame && items[0].gameBounds ? items[0].gameBounds.h : 600;

    // Sort by proximity to gravity "floor" (items closest to floor settle first)
    items.sort((a, b) => {
      switch (direction) {
        case 'down': return (b.y + b.h) - (a.y + a.h);
        case 'up': return a.y - b.y;
        case 'right': return (b.x + b.w) - (a.x + a.w);
        case 'left': return a.x - b.x;
        case 'center': {
          const cx = boundsX + boundsW / 2;
          const cy = boundsY + boundsH / 2;
          const distA = Math.sqrt((a.x + a.w / 2 - cx) ** 2 + (a.y + a.h / 2 - cy) ** 2);
          const distB = Math.sqrt((b.x + b.w / 2 - cx) ** 2 + (b.y + b.h / 2 - cy) ** 2);
          return distA - distB;
        }
        default: return 0;
      }
    });

    const gb = isGame ? items[0].gameBounds : null;
    const isRotated = gb && gb.rotation;

    for (const item of items) {
      // Use already-resolved items (updated in-place below) — scoped to same gameGroup
      let blockers = resolved
        .filter(i => i.blocksMovement && i.idx !== item.idx && i.gameGroup === item.gameGroup)
        .map(i => ({ x: i.x, y: i.y, w: i.w, h: i.h }));

      let simX = item.x, simY = item.y;
      if (isRotated) {
        // Transform item and blockers into game-local space
        const local = toLocalSpace(item.x + item.w / 2, item.y + item.h / 2, gb);
        simX = local.x - item.w / 2;
        simY = local.y - item.h / 2;
        blockers = blockers.map(b => {
          const bl = toLocalSpace(b.x + b.w / 2, b.y + b.h / 2, gb);
          return { x: bl.x - b.w / 2, y: bl.y - b.h / 2, w: b.w, h: b.h };
        });
      }

      const frames = simulateGravity(simX, simY, item.w, item.h, direction, blockers,
        isRotated ? boundsW : boundsW, isRotated ? boundsH : boundsH,
        isRotated ? 0 : boundsX, isRotated ? 0 : boundsY);
      const localFinal = frames[frames.length - 1];

      let finalX, finalY;
      if (isRotated) {
        const screen = toScreenSpace(localFinal.x + item.w / 2, localFinal.y + item.h / 2, gb);
        finalX = screen.x - item.w / 2;
        finalY = screen.y - item.h / 2;
      } else {
        finalX = localFinal.x;
        finalY = localFinal.y;
      }

      if (Math.abs(finalX - item.x) > 0.5 || Math.abs(finalY - item.y) > 0.5) {
        setItemPosition(cpId, roomId, item.idx, finalX, finalY);
        // Update resolved array in-place so subsequent items see settled positions
        resolved[item.idx].x = finalX;
        resolved[item.idx].y = finalY;
        // Only persist for non-game draggable-persist items
        if (!item.gameGroup && room.items[item.idx]?.behavior === 'draggable-persist') {
          updateRoomItemPosition(cpId, roomId, item.idx, finalX, finalY);
        }
        events.push({ itemIndex: item.idx, startX: item.x, startY: item.y, direction });
      }
    }
  }
  return events;
}

// Run gravity on a single item and broadcast. Returns final position or null if no movement.
function applyGravityToItem(cpId, roomId, room, itemIndex) {
  const resolved = resolveRoomItems(room, cpId, roomId);
  const item = resolved[itemIndex];
  if (!item || !item.gravity) return null;

  // Use game gravity direction and bounds if this is a game item
  const isGame = !!item.gameGroup;
  const direction = isGame ? (item.gameGravityDirection || 'down') : (room.gravityDirection || 'down');
  const boundsX = isGame && item.gameBounds ? item.gameBounds.x : 0;
  const boundsY = isGame && item.gameBounds ? item.gameBounds.y : 0;
  const boundsW = isGame && item.gameBounds ? item.gameBounds.w : 800;
  const boundsH = isGame && item.gameBounds ? item.gameBounds.h : 600;

  // Scope blockers to same gameGroup
  const gb = isGame ? item.gameBounds : null;
  const isRotated = gb && gb.rotation;
  let blockers = resolved
    .filter(i => i.blocksMovement && i.idx !== itemIndex && i.gameGroup === item.gameGroup)
    .map(i => ({ x: i.x, y: i.y, w: i.w, h: i.h }));

  let simX = item.x, simY = item.y;
  if (isRotated) {
    const local = toLocalSpace(item.x + item.w / 2, item.y + item.h / 2, gb);
    simX = local.x - item.w / 2;
    simY = local.y - item.h / 2;
    blockers = blockers.map(b => {
      const bl = toLocalSpace(b.x + b.w / 2, b.y + b.h / 2, gb);
      return { x: bl.x - b.w / 2, y: bl.y - b.h / 2, w: b.w, h: b.h };
    });
  }

  const frames = simulateGravity(simX, simY, item.w, item.h, direction, blockers,
    boundsW, boundsH, isRotated ? 0 : boundsX, isRotated ? 0 : boundsY);
  const localFinal = frames[frames.length - 1];

  let finalX, finalY;
  if (isRotated) {
    const screen = toScreenSpace(localFinal.x + item.w / 2, localFinal.y + item.h / 2, gb);
    finalX = screen.x - item.w / 2;
    finalY = screen.y - item.h / 2;
  } else {
    finalX = localFinal.x;
    finalY = localFinal.y;
  }

  if (Math.abs(finalX - item.x) < 0.5 && Math.abs(finalY - item.y) < 0.5) return null;

  setItemPosition(cpId, roomId, itemIndex, finalX, finalY);
  if (!isGame && room.items[itemIndex]?.behavior === 'draggable-persist') {
    updateRoomItemPosition(cpId, roomId, itemIndex, finalPos.x, finalPos.y);
  }
  return { itemIndex, startX: item.x, startY: item.y, direction };
}

// Compute spawn coordinates based on spawn config (room-level overrides CP-level)
function computeSpawnCoords(cp, roomId, prevX, prevY) {
  const room = cp.rooms[roomId];
  const config = (room && room.spawnConfig) || cp.spawnConfig || { mode: 'fixed', x: 400, y: 350 };
  switch (config.mode) {
    case 'random':
      return { x: Math.floor(Math.random() * 800), y: Math.floor(Math.random() * 600) };
    case 'opposite':
      if (prevX != null && prevY != null) {
        return { x: 800 - prevX, y: 600 - prevY };
      }
      // No previous position (first join) — fall back to center
      return { x: 400, y: 350 };
    case 'fixed':
    default:
      return { x: config.x ?? 400, y: config.y ?? 350 };
  }
}

function wireSocketEvents() {
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);
  chatRateLimits.set(socket.id, []);

  socket.on('join', ({ name, cpId, token }) => {
    const done = trackStart('socket:join', cpId);
    const cp = getClubPenguin(cpId);
    if (!cp) { done(); return; }

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
    const spawn = computeSpawnCoords(cp, spawnRoom, null, null);
    const penguin = addPenguin(socket.id, name, cpId, spawnRoom, accountId, spawn.x, spawn.y);

    // Restore saved inventory and preferences for logged-in users
    if (accountId) {
      const saved = loadInventory(accountId);
      for (const item of saved) {
        penguin.inventory.push(item);
        if (item.equipped) {
          penguin.clothes.push(item);
        }
      }
      const prefs = db.prepare('SELECT hide_emoji FROM account_preferences WHERE account_id = ?').get(accountId);
      if (prefs?.hide_emoji) penguin.hideEmoji = true;
    }

    const room = cp.rooms[penguin.roomId];
    const expandedItems = expandRoomItems(room);
    const expandedRoom = { ...room, items: expandedItems };

    // Settle gravity items before sending room state
    if (expandedItems.length > 0) {
      settleGravityItems(cpId, penguin.roomId, expandedRoom);
    }

    socket.emit('roomState', {
      room: expandedRoom,
      penguins: getPenguinsInCPRoom(cpId, penguin.roomId),
      you: penguin.id,
      catalogItems: resolveCatalogItems(room, expandedItems),
      inventory: penguin.inventory,
      clothes: penguin.clothes,
      dragOverrides: getDragOverrides(cpId, penguin.roomId),
    });

    broadcastToCPRoom(cpId, penguin.roomId, 'penguinJoined', penguin, socket.id);
    io.emit('clubPenguinUpdated', cpSummary(cpId));
    done();
  });

  socket.on('move', ({ x, y }) => {
    // Clamp to room bounds
    x = Math.max(0, Math.min(800, x));
    y = Math.max(0, Math.min(600, y));
    const penguin = getPenguin(socket.id);
    if (!penguin) return;
    const done = trackStart('socket:move', penguin.cpId);

    const cp = getClubPenguin(penguin.cpId);
    if (cp) {
      const room = cp.rooms[penguin.roomId];
      if (room && room.items) {
        // Use expanded items (games exploded into individual items) for physics
        const expandedItems = expandRoomItems(room);
        const expandedRoom = { ...room, items: expandedItems };
        const resolvedItems = resolveRoomItems(expandedRoom, penguin.cpId, penguin.roomId);

        // Save original target for skid detection (before blocker adjustment)
        const origX = x;
        const origY = y;

        // Apply collision with blocking items — only non-game items block penguins
        // (penguins walk freely through game areas, game blockers only affect game items)
        const blockers = resolvedItems.filter(i => i.blocksMovement && !i.gameGroup);
        if (blockers.length > 0) {
          const adjusted = adjustMoveTarget(penguin.x, penguin.y, x, y, blockers);
          x = adjusted.x;
          y = adjusted.y;
        }

        // Check for skid item pushes using the ORIGINAL path (pre-blocker adjustment)
        const origDistance = Math.sqrt((origX - penguin.x) ** 2 + (origY - penguin.y) ** 2);
        if (origDistance > 1) {
          const dirX = (origX - penguin.x) / origDistance;
          const dirY = (origY - penguin.y) / origDistance;

          for (const item of resolvedItems) {
            if (!item.skid) continue;
            // Check if penguin's original path crosses this item
            const hit = lineRectIntersection(penguin.x, penguin.y, origX, origY, item);
            if (!hit) continue;

            // Calculate push velocity from original movement distance
            const speed = Math.min(origDistance * 0.6, 400);
            const vx = dirX * speed / 60; // per-frame velocity
            const vy = dirY * speed / 60;

            // Get blockers for the skid sim — scoped by gameGroup
            const skidGb = item.gameBounds;
            const skidRotated = skidGb && skidGb.rotation;
            let skidBlockers = resolvedItems
              .filter(i => i.blocksMovement && i.idx !== item.idx && i.gameGroup === item.gameGroup)
              .map(i => ({ x: i.x, y: i.y, w: i.w, h: i.h }));

            // Use game bounds for game items, room bounds for room items
            const boundsW = skidGb ? skidGb.w : 800;
            const boundsH = skidGb ? skidGb.h : 600;
            const boundsX = skidGb ? skidGb.x : 0;
            const boundsY = skidGb ? skidGb.y : 0;

            let simSkidX = item.x, simSkidY = item.y;
            let simVx = vx, simVy = vy;
            if (skidRotated) {
              const local = toLocalSpace(item.x + item.w / 2, item.y + item.h / 2, skidGb);
              simSkidX = local.x - item.w / 2;
              simSkidY = local.y - item.h / 2;
              // Rotate velocity into local space
              const rot = -(skidGb.rotation) * Math.PI / 180;
              const cos = Math.cos(rot);
              const sin = Math.sin(rot);
              simVx = vx * cos - vy * sin;
              simVy = vx * sin + vy * cos;
              skidBlockers = skidBlockers.map(b => {
                const bl = toLocalSpace(b.x + b.w / 2, b.y + b.h / 2, skidGb);
                return { x: bl.x - b.w / 2, y: bl.y - b.h / 2, w: b.w, h: b.h };
              });
            }

            const frames = simulateSkid(simSkidX, simSkidY, item.w, item.h, simVx, simVy, skidBlockers,
              boundsW, boundsH, skidRotated ? 0 : boundsX, skidRotated ? 0 : boundsY);
            const localFinalSkid = frames[frames.length - 1];

            let finalSkidX, finalSkidY;
            if (skidRotated) {
              const screen = toScreenSpace(localFinalSkid.x + item.w / 2, localFinalSkid.y + item.h / 2, skidGb);
              finalSkidX = screen.x - item.w / 2;
              finalSkidY = screen.y - item.h / 2;
            } else {
              finalSkidX = localFinalSkid.x;
              finalSkidY = localFinalSkid.y;
            }

            // Store final position (use expanded index)
            setItemPosition(penguin.cpId, penguin.roomId, item.idx, finalSkidX, finalSkidY);
            // Only persist for non-game draggable-persist items
            if (!item.gameGroup && expandedItems[item.idx]?.behavior === 'draggable-persist') {
              updateRoomItemPosition(penguin.cpId, penguin.roomId, item.idx, finalSkidX, finalSkidY);
            }

            // Broadcast push to all clients (include hit.t so clients can delay animation)
            broadcastToCPRoom(penguin.cpId, penguin.roomId, 'itemPushed', {
              itemIndex: item.idx,
              startX: item.x,
              startY: item.y,
              vx, vy,
              hitT: hit.t,
              penguinDistance: origDistance,
            });

            // If pushed item has gravity, apply gravity after skid settles
            if (expandedItems[item.idx]?.gravity) {
              const gravEvent = applyGravityToItem(penguin.cpId, penguin.roomId, expandedRoom, item.idx);
              if (gravEvent) {
                broadcastToCPRoom(penguin.cpId, penguin.roomId, 'itemGravity', gravEvent);
              }
            }
          }
        }
      }
    }

    movePenguin(socket.id, x, y);
    broadcastToCPRoom(penguin.cpId, penguin.roomId, 'penguinMoved', {
      id: penguin.id,
      x,
      y,
    }, socket.id);
    done();
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
    const done = trackStart('socket:changeRoom', penguin.cpId);

    const cp = getClubPenguin(penguin.cpId);
    if (!cp || !cp.rooms[roomId]) return;

    const oldRoom = penguin.roomId;
    const prevX = penguin.x;
    const prevY = penguin.y;

    broadcastToCPRoom(penguin.cpId, oldRoom, 'penguinLeft', { id: penguin.id, name: penguin.name }, socket.id);

    const spawn = computeSpawnCoords(cp, roomId, prevX, prevY);
    changePenguinRoom(socket.id, roomId, spawn.x, spawn.y);

    const newRoom = cp.rooms[roomId];
    const expandedItems = expandRoomItems(newRoom);
    const expandedNewRoom = { ...newRoom, items: expandedItems };

    // Settle gravity items before sending room state
    if (expandedItems.length > 0) {
      settleGravityItems(penguin.cpId, roomId, expandedNewRoom);
    }

    socket.emit('roomState', {
      room: expandedNewRoom,
      penguins: getPenguinsInCPRoom(penguin.cpId, roomId),
      you: penguin.id,
      catalogItems: resolveCatalogItems(newRoom, expandedItems),
      dragOverrides: getDragOverrides(penguin.cpId, roomId),
    });

    broadcastToCPRoom(penguin.cpId, roomId, 'penguinJoined', penguin, socket.id);
    done();
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
      hideEmoji: penguin.hideEmoji,
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
      hideEmoji: penguin.hideEmoji,
    });
  });

  socket.on('setHideEmoji', (hide) => {
    const penguin = getPenguin(socket.id);
    if (!penguin) return;

    penguin.hideEmoji = !!hide;

    // Persist for logged-in users
    if (penguin.accountId) {
      db.prepare(
        `INSERT INTO account_preferences (account_id, hide_emoji) VALUES (?, ?)
         ON CONFLICT(account_id) DO UPDATE SET hide_emoji = ?`
      ).run(penguin.accountId, hide ? 1 : 0, hide ? 1 : 0);
    }

    // Broadcast to room (reuse clothes changed event since it's visual)
    broadcastToCPRoom(penguin.cpId, penguin.roomId, 'penguinClothesChanged', {
      id: penguin.id,
      clothes: penguin.clothes,
      hideEmoji: penguin.hideEmoji,
    });
    socket.emit('hideEmojiUpdated', { hideEmoji: penguin.hideEmoji });
  });

  // --- Drag events ---

  socket.on('dragStart', ({ itemIndex }) => {
    const penguin = getPenguin(socket.id);
    if (!penguin) return;
    const cp = getClubPenguin(penguin.cpId);
    if (!cp) return;
    const room = cp.rooms[penguin.roomId];
    if (!room || !room.items) return;
    // Use expanded items (client sees expanded indices)
    const expandedItems = expandRoomItems(room);
    if (itemIndex < 0 || itemIndex >= expandedItems.length) return;
    const item = expandedItems[itemIndex];
    if (!item.behavior || !item.behavior.startsWith('draggable')) return;

    if (!startDrag(penguin.cpId, penguin.roomId, itemIndex, socket.id)) {
      return; // locked by another penguin
    }

    broadcastToCPRoom(penguin.cpId, penguin.roomId, 'itemDragStart', {
      itemIndex,
      draggedBy: penguin.id,
    }, socket.id);
  });

  socket.on('dragMove', ({ itemIndex, x, y }) => {
    const penguin = getPenguin(socket.id);
    if (!penguin) return;
    const done = trackStart('socket:dragMove', penguin.cpId);
    const cp = getClubPenguin(penguin.cpId);
    if (!cp) return;
    const room = cp.rooms[penguin.roomId];
    if (!room) return;
    // Clamp to game bounds or room bounds
    const expandedItems = expandRoomItems(room);
    const item = expandedItems[itemIndex];
    if (item?.gameBounds && item.gameBounds.rotation) {
      const gb = item.gameBounds;
      const gcx = gb.x + gb.w / 2;
      const gcy = gb.y + gb.h / 2;
      const rot = -gb.rotation * Math.PI / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      // Un-rotate to local space
      let lx = (x + item.width / 2 - gcx) * cos - (y + item.height / 2 - gcy) * sin;
      let ly = (x + item.width / 2 - gcx) * sin + (y + item.height / 2 - gcy) * cos;
      // Clamp in local bounds
      lx = Math.max(-gb.w / 2 + item.width / 2, Math.min(gb.w / 2 - item.width / 2, lx));
      ly = Math.max(-gb.h / 2 + item.height / 2, Math.min(gb.h / 2 - item.height / 2, ly));
      // Rotate back
      const cos2 = Math.cos(-rot);
      const sin2 = Math.sin(-rot);
      const sx = gcx + lx * cos2 - ly * sin2;
      const sy = gcy + lx * sin2 + ly * cos2;
      x = sx - item.width / 2;
      y = sy - item.height / 2;
    } else if (item?.gameBounds) {
      x = Math.max(item.gameBounds.x, Math.min(item.gameBounds.x + item.gameBounds.w - item.width, x));
      y = Math.max(item.gameBounds.y, Math.min(item.gameBounds.y + item.gameBounds.h - item.height, y));
    } else {
      x = Math.max(0, Math.min(800, x));
      y = Math.max(0, Math.min(600, y));
    }
    moveDragItem(penguin.cpId, penguin.roomId, itemIndex, x, y);
    broadcastToCPRoom(penguin.cpId, penguin.roomId, 'itemDragMoved', {
      itemIndex, x, y,
    }, socket.id);
    done();
  });

  socket.on('dragEnd', ({ itemIndex }) => {
    const penguin = getPenguin(socket.id);
    if (!penguin) return;
    const entry = stopDrag(penguin.cpId, penguin.roomId, itemIndex);
    if (!entry) return;

    const cp = getClubPenguin(penguin.cpId);
    const room = cp && cp.rooms[penguin.roomId];
    const expandedItems = room ? expandRoomItems(room) : null;

    if (cp && entry.x != null && entry.y != null && expandedItems) {
      const item = expandedItems[itemIndex];
      // Only persist for non-game draggable-persist items
      if (item && !item.gameGroup && item.behavior === 'draggable-persist') {
        updateRoomItemPosition(penguin.cpId, penguin.roomId, itemIndex, entry.x, entry.y);
      }
    }

    broadcastToCPRoom(penguin.cpId, penguin.roomId, 'itemDragEnd', {
      itemIndex,
      x: entry.x,
      y: entry.y,
    }, socket.id);

    // If released item has gravity, apply gravity from release point
    if (cp && expandedItems) {
      const expandedRoom = { ...room, items: expandedItems };
      const item = expandedItems[itemIndex];
      if (item?.gravity) {
        setItemPosition(penguin.cpId, penguin.roomId, itemIndex, entry.x, entry.y);
        const gravEvent = applyGravityToItem(penguin.cpId, penguin.roomId, expandedRoom, itemIndex);
        if (gravEvent) {
          broadcastToCPRoom(penguin.cpId, penguin.roomId, 'itemGravity', gravEvent);
        }
      }
    }
  });

  function validateItemAccess(rooms, accountId) {
    for (const room of Object.values(rooms)) {
      for (const item of (room.items || [])) {
        if (item.gameId) {
          // Game placement — check game access
          if (!canAccessGame(accountId, item.gameId)) {
            const game = getGame(item.gameId);
            const label = game ? `"${game.name}"` : item.gameId;
            return `You don't have access to game ${label} — acquire it from the Catalog first`;
          }
        } else if (item.catalogId && !canAccessItem(accountId, item.catalogId)) {
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

    const cp = createClubPenguin(data.name.trim(), data.rooms, creatorAccountId, data.spawnConfig || null);
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

    const cp = updateClubPenguin(data.id, data.name.trim(), data.rooms, data.spawnConfig || null);
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

  function releaseDragLocks() {
    const released = clearDragLocks(socket.id);
    for (const r of released) {
      const [cpId, roomId] = r.key.split(':');
      broadcastToCPRoom(cpId, roomId, 'itemDragEnd', {
        itemIndex: r.itemIndex,
        x: r.x,
        y: r.y,
      });
    }
  }

  socket.on('leaveCP', () => {
    releaseDragLocks();
    const penguin = removePenguin(socket.id);
    if (penguin) {
      broadcastToCPRoom(penguin.cpId, penguin.roomId, 'penguinLeft', { id: penguin.id, name: penguin.name });
      io.emit('clubPenguinUpdated', cpSummary(penguin.cpId));
    }
  });

  socket.on('disconnect', () => {
    releaseDragLocks();
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
