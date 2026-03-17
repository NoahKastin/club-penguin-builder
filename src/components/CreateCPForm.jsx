import React, { useState, useEffect } from 'react';
import * as socket from '../network/socket';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '100%',
    overflowY: 'auto',
    padding: '8px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '100%',
  },
  label: {
    fontSize: '0.9rem',
    color: '#aaa',
  },
  input: {
    padding: '8px 12px',
    fontSize: '1rem',
    borderRadius: '6px',
    border: '2px solid #555',
    background: '#2a2a3e',
    color: '#eee',
    outline: 'none',
  },
  colorInput: {
    width: '60px',
    height: '36px',
    border: '2px solid #555',
    borderRadius: '6px',
    background: '#2a2a3e',
    cursor: 'pointer',
  },
  roomCard: {
    width: '100%',
    padding: '12px',
    background: '#2a2a3e',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  roomHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  exitCard: {
    padding: '8px',
    background: '#1a1a2e',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  smallInput: {
    padding: '6px 8px',
    fontSize: '0.85rem',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#333',
    color: '#eee',
    outline: 'none',
    width: '70px',
  },
  select: {
    padding: '6px 8px',
    fontSize: '0.85rem',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#333',
    color: '#eee',
    outline: 'none',
  },
  button: {
    padding: '8px 20px',
    fontSize: '1rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4a90d9',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  smallButton: {
    padding: '4px 12px',
    fontSize: '0.85rem',
    borderRadius: '6px',
    border: 'none',
    background: '#4a90d9',
    color: '#fff',
    cursor: 'pointer',
  },
  dangerButton: {
    padding: '4px 12px',
    fontSize: '0.85rem',
    borderRadius: '6px',
    border: 'none',
    background: '#d94a4a',
    color: '#fff',
    cursor: 'pointer',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '0.9rem',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
  },
};

let roomCounter = 2;

function makeRoomId() {
  return 'room_' + (roomCounter++);
}

function RoomPreview({ room, catalogItems, games }) {
  const [open, setOpen] = useState(false);
  const scale = 0.5; // 800x600 → 400x300
  const catMap = {};
  for (const ci of catalogItems) catMap[ci.id] = ci;
  const gameMap = {};
  for (const g of (games || [])) gameMap[g.id] = g;

  return (
    <div style={{ marginTop: '4px' }}>
      <button
        style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Hide Preview' : 'Preview'}
      </button>
      {open && (
        <div style={{
          position: 'relative',
          width: 800 * scale,
          height: 600 * scale,
          background: room.bgColor || '#333333',
          borderRadius: '6px',
          overflow: 'hidden',
          marginTop: '6px',
          border: '1px solid #555',
        }}>
          {(room.items || []).map((item, i) => {
            if (item.gameId) {
              const game = gameMap[item.gameId];
              if (!game || !game.width || !game.height) {
                return (
                  <div key={i} style={{
                    position: 'absolute', left: item.x * scale, top: item.y * scale,
                    width: item.width * scale, height: item.height * scale,
                    border: '2px dashed #6a9f4a', background: 'rgba(106, 159, 74, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: `${Math.max(8, 10 * scale)}px`, color: '#6a9f4a', pointerEvents: 'none',
                  }}>Game</div>
                );
              }
              const gsx = item.width / game.width;
              const gsy = item.height / game.height;
              const gameRot = item.rotation || 0;
              return (
                <div key={i} style={{
                  position: 'absolute', left: item.x * scale, top: item.y * scale,
                  width: item.width * scale, height: item.height * scale,
                  border: '1px dashed #6a9f4a', overflow: 'hidden', pointerEvents: 'none',
                  transform: gameRot ? `rotate(${gameRot}deg)` : undefined,
                }}>
                  {game.items.map((gi, gi_idx) => {
                    const ci = catMap[gi.catalogId];
                    if (!ci) return null;
                    return <img key={gi_idx} src={ci.image} alt="" style={{
                      position: 'absolute',
                      left: gi.x * gsx * scale,
                      top: gi.y * gsy * scale,
                      width: gi.width * gsx * scale,
                      height: gi.height * gsy * scale,
                      transform: gi.rotation ? `rotate(${gi.rotation}deg)` : undefined,
                      objectFit: 'fill', pointerEvents: 'none',
                    }} />;
                  })}
                </div>
              );
            }
            const ci = catMap[item.catalogId];
            if (!ci) return null;
            const rot = item.rotation || 0;
            return (
              <img
                key={i}
                src={ci.image}
                alt={ci.name}
                style={{
                  position: 'absolute',
                  left: item.x * scale,
                  top: item.y * scale,
                  width: item.width * scale,
                  height: item.height * scale,
                  transform: rot ? `rotate(${rot}deg)` : undefined,
                  objectFit: 'fill',
                  border: item.behavior === 'collectible' ? '2px solid white' : item.behavior?.startsWith('draggable') ? '2px solid black' : item.blocksMovement ? '2px dashed red' : 'none',
                  outline: item.blocksMovement && item.behavior ? '2px dashed red' : 'none',
                  pointerEvents: 'none',
                }}
              />
            );
          })}
          {(room.exits || []).map((exit, i) => (
            <div
              key={'exit_' + i}
              style={{
                position: 'absolute',
                left: exit.x * scale,
                top: exit.y * scale,
                width: exit.width * scale,
                height: exit.height * scale,
                background: 'rgba(255,255,255,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${Math.max(8, 12 * scale)}px`,
                fontWeight: 'bold',
                color: '#fff',
                textShadow: '0 0 3px #000',
                pointerEvents: 'none',
              }}
            >
              {exit.label || exit.targetRoom}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GameExportPreview({ room, catalogItems }) {
  const [open, setOpen] = useState(false);
  const catMap = {};
  for (const ci of catalogItems) catMap[ci.id] = ci;

  const regularItems = (room.items || []).filter(i => !i.gameId);
  if (regularItems.length === 0) return null;

  // Compute bounding box (same logic as handleExport)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of regularItems) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }
  const gameW = maxX - minX;
  const gameH = maxY - minY;
  if (gameW <= 0 || gameH <= 0) return null;

  // Scale to fit within 400px wide, preserving aspect ratio
  const maxPreviewW = 400;
  const scale = Math.min(maxPreviewW / gameW, 1);

  return (
    <div>
      <button
        style={{ padding: '4px 12px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Hide Preview' : 'Preview Export'}
      </button>
      {open && (
        <div style={{ marginTop: '6px' }}>
          <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '4px' }}>
            {Math.round(gameW)} x {Math.round(gameH)} px
          </div>
          <div style={{
            position: 'relative',
            width: gameW * scale,
            height: gameH * scale,
            background: '#222',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid #6a9f4a',
          }}>
            {regularItems.map((item, i) => {
              const ci = catMap[item.catalogId];
              if (!ci) return null;
              const rot = item.rotation || 0;
              return (
                <img
                  key={i}
                  src={ci.image}
                  alt={ci.name}
                  style={{
                    position: 'absolute',
                    left: (item.x - minX) * scale,
                    top: (item.y - minY) * scale,
                    width: item.width * scale,
                    height: item.height * scale,
                    transform: rot ? `rotate(${rot}deg)` : undefined,
                    objectFit: 'fill',
                    pointerEvents: 'none',
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// editCpId: if set, we're editing an existing CP
export default function CreateCPForm({ editCpId, authToken, accountId, onCreated, onCancel }) {
  const [cpName, setCpName] = useState('');
  const [rooms, setRooms] = useState([
    { tempId: 'room_1', name: 'Lobby', bgColor: '#333333', hidden: false, gravityDirection: null, spawnConfig: null, exits: [], items: [] },
  ]);
  const [partyName, setPartyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!editCpId);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogSortField, setCatalogSortField] = useState('name');
  const [catalogSortDir, setCatalogSortDir] = useState('asc');
  const [favorites, setFavorites] = useState(new Set());
  const [catalogSearch, setCatalogSearch] = useState('');
  const [acquiredItems, setAcquiredItems] = useState(new Set());
  const [availableGames, setAvailableGames] = useState([]);
  const [acquiredGames, setAcquiredGames] = useState(new Set());
  const [exportingRoom, setExportingRoom] = useState(null); // roomIndex being exported
  const [exportName, setExportName] = useState('');
  const [exportAttribution, setExportAttribution] = useState('');
  const [exportPrice, setExportPrice] = useState(0);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');
  const [spawnConfig, setSpawnConfig] = useState({ mode: 'fixed', x: 400, y: 350 });

  useEffect(() => {
    fetch('/api/catalog').then(r => r.json()).then(setCatalogItems).catch(() => {});
    fetch('/api/games').then(r => r.json()).then(setAvailableGames).catch(() => {});
    if (authToken) {
      fetch('/api/auth/preferences', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(prefs => {
          if (prefs) {
            setCatalogSortField(prefs.catalog_sort_field || 'name');
            setCatalogSortDir(prefs.catalog_sort_dir || 'asc');
          }
        });
      fetch('/api/auth/favorites', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : [])
        .then(ids => setFavorites(new Set(ids)));
      fetch('/api/account/purchases', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : [])
        .then(ids => setAcquiredItems(new Set(ids)));
      fetch('/api/account/game-purchases', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : [])
        .then(ids => setAcquiredGames(new Set(ids)));
    }
  }, []);

  useEffect(() => {
    if (!editCpId) return;
    fetch(`/api/clubpenguins/${editCpId}`)
      .then(r => r.json())
      .then(cp => {
        setCpName(cp.name);
        if (cp.spawnConfig) setSpawnConfig(cp.spawnConfig);
        const roomList = Object.values(cp.rooms).map(r => ({
          tempId: r.id,
          name: r.name,
          bgColor: r.bgColor,
          hidden: r.hidden || false,
          gravityDirection: r.gravityDirection || null,
          spawnConfig: r.spawnConfig || null,
          exits: (r.exits || []).map(e => ({
            targetRoom: e.targetRoom,
            label: e.label,
            x: e.x,
            y: e.y,
            width: e.width,
            height: e.height,
          })),
          items: (r.items || []).map(item => item.gameId
            ? { gameId: item.gameId, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation || 0 }
            : { ...item, rotation: item.rotation || 0 }
          ),
        }));
        // Update roomCounter to avoid collisions
        for (const r of roomList) {
          const match = r.tempId.match(/^room_(\d+)$/);
          if (match && Number(match[1]) >= roomCounter) {
            roomCounter = Number(match[1]) + 1;
          }
        }
        setRooms(roomList);
        setLoading(false);
      });
  }, [editCpId]);

  function addRoom() {
    setRooms([...rooms, { tempId: makeRoomId(), name: '', bgColor: '#333333', hidden: false, gravityDirection: null, spawnConfig: null, exits: [], items: [] }]);
  }

  function removeRoom(index) {
    if (rooms.length <= 1) return;
    const removed = rooms[index];
    const updated = rooms.filter((_, i) => i !== index);
    for (let i = 0; i < updated.length; i++) {
      updated[i] = {
        ...updated[i],
        exits: updated[i].exits.filter(e => e.targetRoom !== removed.tempId),
      };
    }
    setRooms(updated);
  }

  function updateRoom(index, field, value) {
    const updated = [...rooms];
    updated[index] = { ...updated[index], [field]: value };
    setRooms(updated);
  }

  function addExit(roomIndex) {
    const updated = [...rooms];
    const otherRooms = rooms.filter((_, i) => i !== roomIndex);
    const defaultTarget = otherRooms.length > 0 ? otherRooms[0].tempId : '';
    updated[roomIndex] = {
      ...updated[roomIndex],
      exits: [...updated[roomIndex].exits, { targetRoom: defaultTarget, label: '', x: 10, y: 200, width: 100, height: 100 }],
    };
    setRooms(updated);
  }

  function removeExit(roomIndex, exitIndex) {
    const updated = [...rooms];
    updated[roomIndex] = {
      ...updated[roomIndex],
      exits: updated[roomIndex].exits.filter((_, i) => i !== exitIndex),
    };
    setRooms(updated);
  }

  function updateExit(roomIndex, exitIndex, field, value) {
    const updated = [...rooms];
    const exits = [...updated[roomIndex].exits];
    exits[exitIndex] = { ...exits[exitIndex], [field]: field === 'x' || field === 'y' || field === 'width' || field === 'height' ? Number(value) : value };
    updated[roomIndex] = { ...updated[roomIndex], exits };
    setRooms(updated);
  }

  function addItem(roomIndex) {
    const updated = [...rooms];
    let available = sortedCatalogItems();
    if (catalogSearch.trim()) {
      const q = catalogSearch.trim().toLowerCase();
      const searched = available.filter(ci => ci.name.toLowerCase().startsWith(q));
      if (searched.length > 0) available = searched;
    }
    const defaultCatalogId = available.length > 0 ? available[0].id : '';
    updated[roomIndex] = {
      ...updated[roomIndex],
      items: [...updated[roomIndex].items, {
        catalogId: defaultCatalogId, x: 100, y: 100, width: 100, height: 100, rotation: 0,
        behavior: null, blocksMovement: false, skid: false, gravity: false, wearOffsetX: 0, wearOffsetY: 0, wearWidth: 40, wearHeight: 40,
      }],
    };
    setRooms(updated);
  }

  function removeItem(roomIndex, itemIndex) {
    const updated = [...rooms];
    updated[roomIndex] = {
      ...updated[roomIndex],
      items: updated[roomIndex].items.filter((_, i) => i !== itemIndex),
    };
    setRooms(updated);
  }

  function moveItem(roomIndex, itemIndex, direction) {
    const updated = [...rooms];
    const items = [...updated[roomIndex].items];
    const newIndex = itemIndex + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    [items[itemIndex], items[newIndex]] = [items[newIndex], items[itemIndex]];
    updated[roomIndex] = { ...updated[roomIndex], items };
    setRooms(updated);
  }

  function duplicateItem(roomIndex, itemIndex) {
    const updated = [...rooms];
    const items = [...updated[roomIndex].items];
    const clone = { ...items[itemIndex] };
    items.splice(itemIndex + 1, 0, clone);
    updated[roomIndex] = { ...updated[roomIndex], items };
    setRooms(updated);
  }

  function updateItem(roomIndex, itemIndex, field, value) {
    const updated = [...rooms];
    const items = [...updated[roomIndex].items];
    const numFieldsAuto = ['x', 'y', 'width', 'height', 'rotation', 'wearWidth', 'wearHeight'];
    items[itemIndex] = { ...items[itemIndex], [field]: numFieldsAuto.includes(field) ? Number(value) : value };
    updated[roomIndex] = { ...updated[roomIndex], items };
    setRooms(updated);
  }

  function sortedCatalogItems() {
    const filtered = catalogItems.filter(ci =>
      ci.uploaderId === accountId || acquiredItems.has(ci.id)
    );
    return [...filtered].sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;

      let cmp = 0;
      switch (catalogSortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'createdAt': cmp = (a.createdAt || 0) - (b.createdAt || 0); break;
        case 'attribution': cmp = (a.attribution || '').localeCompare(b.attribution || ''); break;
      }
      return catalogSortDir === 'desc' ? -cmp : cmp;
    });
  }

  function canExportRoom(room) {
    if (!room.items || room.items.length === 0) return false;
    // Only regular items (not game placements) can be exported
    const regularItems = room.items.filter(i => !i.gameId);
    if (regularItems.length === 0) return false;
    // All items must be the current user's own uploads
    for (const item of regularItems) {
      const ci = catalogItems.find(c => c.id === item.catalogId);
      if (!ci || ci.uploaderId !== accountId) return false;
    }
    return true;
  }

  function handleExport(roomIndex) {
    setExportError('');
    setExportSuccess('');
    if (!exportName.trim()) { setExportError('Name is required'); return; }

    const room = rooms[roomIndex];
    const regularItems = room.items.filter(i => !i.gameId);

    // Compute bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const item of regularItems) {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
    }
    const gameWidth = maxX - minX;
    const gameHeight = maxY - minY;

    // Translate items relative to bounding box origin
    const gameItems = regularItems.map(item => ({
      catalogId: item.catalogId,
      x: item.x - minX,
      y: item.y - minY,
      width: item.width,
      height: item.height,
      rotation: item.rotation || 0,
      behavior: item.behavior || null,
      blocksMovement: !!item.blocksMovement,
      skid: !!item.skid,
      gravity: !!item.gravity,
      wearOffsetX: item.wearOffsetX || 0,
      wearOffsetY: item.wearOffsetY || 0,
      wearWidth: item.wearWidth || 40,
      wearHeight: item.wearHeight || 40,
    }));

    fetch('/api/games/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        name: exportName.trim(),
        attribution: exportAttribution.trim(),
        items: gameItems,
        width: gameWidth,
        height: gameHeight,
        gravityDirection: room.gravityDirection || null,
        price: exportPrice || 0,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setExportError(data.error); return; }
        setExportSuccess(`Game "${exportName.trim()}" exported!`);
        setExportName('');
        setExportAttribution('');
        setExportPrice(0);
        setExportingRoom(null);
        // Refresh available games
        fetch('/api/games').then(r => r.json()).then(setAvailableGames).catch(() => {});
      })
      .catch(() => setExportError('Export failed'));
  }

  function ownedGames() {
    return availableGames.filter(g =>
      g.creatorId === accountId || acquiredGames.has(g.id)
    );
  }

  function addGame(roomIndex) {
    const owned = ownedGames();
    if (owned.length === 0) return;
    const updated = [...rooms];
    const game = owned[0];
    updated[roomIndex] = {
      ...updated[roomIndex],
      items: [...updated[roomIndex].items, {
        gameId: game.id, x: 100, y: 100, width: game.width, height: game.height, rotation: 0,
      }],
    };
    setRooms(updated);
  }

  function cloneGameAsItems(roomIndex, gameId) {
    const game = availableGames.find(g => g.id === gameId);
    if (!game) return;
    const clonedItems = game.items.map(gi => ({
      catalogId: gi.catalogId,
      x: gi.x,
      y: gi.y,
      width: gi.width,
      height: gi.height,
      rotation: gi.rotation || 0,
      behavior: gi.behavior || null,
      blocksMovement: !!gi.blocksMovement,
      skid: !!gi.skid,
      gravity: !!gi.gravity,
      wearOffsetX: gi.wearOffsetX || 0,
      wearOffsetY: gi.wearOffsetY || 0,
      wearWidth: gi.wearWidth || 40,
      wearHeight: gi.wearHeight || 40,
    }));
    const updated = [...rooms];
    updated[roomIndex] = {
      ...updated[roomIndex],
      items: [...updated[roomIndex].items, ...clonedItems],
    };
    setRooms(updated);
  }

  function handleSubmit() {
    setError('');
    if (!cpName.trim()) {
      setError('Club Penguin name is required');
      return;
    }
    if (rooms.some(r => !r.name.trim())) {
      setError('All rooms need a name');
      return;
    }

    if (rooms.every(r => r.hidden)) {
      setError('At least one room must not be hidden');
      return;
    }

    const roomsObj = {};
    for (const room of rooms) {
      roomsObj[room.tempId] = {
        id: room.tempId,
        name: room.name.trim(),
        bgColor: room.bgColor,
        hidden: room.hidden || false,
        gravityDirection: room.gravityDirection || null,
        spawnConfig: room.spawnConfig || undefined,
        exits: room.exits.map(e => ({
          targetRoom: e.targetRoom,
          label: e.label || rooms.find(r => r.tempId === e.targetRoom)?.name || e.targetRoom,
          x: e.x,
          y: e.y,
          width: e.width,
          height: e.height,
        })),
        items: (room.items || []).map(item => {
          if (item.gameId) {
            return { gameId: item.gameId, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation || 0 };
          }
          const base = { catalogId: item.catalogId, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation || 0, behavior: item.behavior, blocksMovement: !!item.blocksMovement, skid: !!item.skid, gravity: !!item.gravity };
          if (item.behavior === 'collectible') {
            base.wearOffsetX = item.wearOffsetX || 0;
            base.wearOffsetY = item.wearOffsetY || 0;
            base.wearWidth = item.wearWidth || 40;
            base.wearHeight = item.wearHeight || 40;
          }
          return base;
        }),
      };
    }

    if (editCpId) {
      socket.editClubPenguin({ id: editCpId, name: cpName.trim(), rooms: roomsObj, spawnConfig, partyName: partyName.trim() || undefined }, (response) => {
        if (response.success) {
          onCreated(response.cp);
        } else {
          setError(response.error || 'Failed to update');
        }
      });
    } else {
      socket.createClubPenguin({ name: cpName.trim(), rooms: roomsObj, spawnConfig }, (response) => {
        if (response.success) {
          onCreated(response.cp);
        } else {
          setError(response.error || 'Failed to create');
        }
      });
    }
  }

  function SpawnConfigEditor({ config, onChange, isRoomLevel }) {
    const mode = config ? config.mode : (isRoomLevel ? null : 'fixed');
    return (
      <div style={styles.row}>
        <label style={styles.label}>Spawn:</label>
        <select
          style={styles.select}
          value={isRoomLevel && !config ? '' : mode}
          onChange={(e) => {
            const v = e.target.value;
            if (isRoomLevel && v === '') { onChange(null); return; }
            if (v === 'fixed') onChange({ mode: 'fixed', x: 400, y: 350 });
            else onChange({ mode: v });
          }}
        >
          {isRoomLevel && <option value="">Use CP default</option>}
          <option value="fixed">Fixed position</option>
          <option value="random">Random</option>
          <option value="opposite">Opposite of last room</option>
        </select>
        {config && config.mode === 'fixed' && (
          <>
            <label style={styles.label}>x</label>
            <input style={styles.smallInput} type="number" min={0} max={800} value={config.x ?? 400} onChange={(e) => onChange({ ...config, x: Math.max(0, Math.min(800, Number(e.target.value))) })} />
            <label style={styles.label}>y</label>
            <input style={styles.smallInput} type="number" min={0} max={600} value={config.y ?? 350} onChange={(e) => onChange({ ...config, y: Math.max(0, Math.min(600, Number(e.target.value))) })} />
          </>
        )}
      </div>
    );
  }

  const sortedCatalog = sortedCatalogItems();

  if (loading) {
    return <div style={styles.container}><div>Loading...</div></div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>{editCpId ? 'Edit' : 'Create'} Club Penguin</div>

      <div style={styles.field}>
        <label style={styles.label}>Name</label>
        <input
          style={styles.input}
          type="text"
          placeholder="My Club Penguin..."
          value={cpName}
          onChange={(e) => setCpName(e.target.value)}
          maxLength={40}
          autoFocus
        />
      </div>

      <div style={styles.field}>
        <SpawnConfigEditor config={spawnConfig} onChange={setSpawnConfig} isRoomLevel={false} />
      </div>

      {rooms.map((room, ri) => (
        <div key={room.tempId} style={styles.roomCard}>
          <div style={styles.roomHeader}>
            <strong>Room {ri + 1}</strong>
            <div style={styles.row}>
              <label style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={room.hidden}
                  onChange={() => updateRoom(ri, 'hidden', !room.hidden)}
                />{' '}
                Hidden (no spawn)
              </label>
              {rooms.length > 1 && (
                <button style={styles.dangerButton} onClick={() => removeRoom(ri)}>Remove</button>
              )}
            </div>
          </div>

          <div style={styles.row}>
            <input
              style={{ ...styles.input, flex: 1 }}
              type="text"
              placeholder="Room name..."
              value={room.name}
              onChange={(e) => updateRoom(ri, 'name', e.target.value)}
              maxLength={30}
            />
            <input
              style={styles.colorInput}
              type="color"
              value={room.bgColor}
              onChange={(e) => updateRoom(ri, 'bgColor', e.target.value)}
            />
          </div>

          {(room.items || []).some(i => i.gravity) && (
            <div style={styles.row}>
              <label style={styles.label}>Gravity:</label>
              <select
                style={styles.select}
                value={room.gravityDirection || 'down'}
                onChange={(e) => updateRoom(ri, 'gravityDirection', e.target.value)}
              >
                <option value="down">Down</option>
                <option value="up">Up</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="center">Center</option>
              </select>
            </div>
          )}

          <SpawnConfigEditor config={room.spawnConfig} onChange={(sc) => updateRoom(ri, 'spawnConfig', sc)} isRoomLevel={true} />

          <div style={{ fontSize: '0.9rem', color: '#aaa' }}>Exits</div>
          {room.exits.map((exit, ei) => (
            <div key={ei} style={styles.exitCard}>
              <div style={styles.row}>
                <label style={styles.label}>To:</label>
                <select
                  style={styles.select}
                  value={exit.targetRoom}
                  onChange={(e) => updateExit(ri, ei, 'targetRoom', e.target.value)}
                >
                  {rooms.filter((_, i) => i !== ri).map(r => (
                    <option key={r.tempId} value={r.tempId}>{r.name || r.tempId}</option>
                  ))}
                </select>
                <label style={styles.label}>Label:</label>
                <input
                  style={{ ...styles.smallInput, width: '100px' }}
                  type="text"
                  placeholder="Exit label..."
                  value={exit.label}
                  onChange={(e) => updateExit(ri, ei, 'label', e.target.value)}
                />
                <button style={styles.dangerButton} onClick={() => removeExit(ri, ei)}>X</button>
              </div>
              <div style={styles.row}>
                <label style={styles.label}>x</label>
                <input style={styles.smallInput} type="number" value={exit.x} onChange={(e) => updateExit(ri, ei, 'x', e.target.value)} />
                <label style={styles.label}>y</label>
                <input style={styles.smallInput} type="number" value={exit.y} onChange={(e) => updateExit(ri, ei, 'y', e.target.value)} />
                <label style={styles.label}>w</label>
                <input style={styles.smallInput} type="number" value={exit.width} onChange={(e) => updateExit(ri, ei, 'width', e.target.value)} />
                <label style={styles.label}>h</label>
                <input style={styles.smallInput} type="number" value={exit.height} onChange={(e) => updateExit(ri, ei, 'height', e.target.value)} />
              </div>
            </div>
          ))}
          {rooms.length > 1 && (
            <button style={styles.smallButton} onClick={() => addExit(ri)}>+ Add Exit</button>
          )}

          <div style={{ fontSize: '0.9rem', color: '#aaa', marginTop: '4px' }}>Items</div>
          {(room.items || []).map((item, ii) => (
            <div key={ii} style={styles.exitCard}>
              {item.gameId ? (
                <>
                  <div style={styles.row}>
                    <label style={styles.label}>Game:</label>
                    <select
                      style={{ ...styles.select, flex: 1 }}
                      value={item.gameId}
                      onChange={(e) => {
                        const game = availableGames.find(g => g.id === e.target.value);
                        if (game) {
                          updateItem(ri, ii, 'gameId', e.target.value);
                          // Update default dimensions to match new game
                          const items = [...rooms[ri].items];
                          items[ii] = { ...items[ii], gameId: e.target.value, width: game.width, height: game.height };
                          const updated = [...rooms];
                          updated[ri] = { ...updated[ri], items };
                          setRooms(updated);
                        }
                      }}
                    >
                      {ownedGames().map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.items.length} items)</option>
                      ))}
                    </select>
                    {ii > 0 && <button style={styles.smallButton} onClick={() => moveItem(ri, ii, -1)} title="Move up">{'\u25B2'}</button>}
                    {ii < (room.items || []).length - 1 && <button style={styles.smallButton} onClick={() => moveItem(ri, ii, 1)} title="Move down">{'\u25BC'}</button>}
                    <button style={styles.smallButton} onClick={() => duplicateItem(ri, ii)} title="Duplicate">{'\u29C9'}</button>
                    <button style={styles.dangerButton} onClick={() => removeItem(ri, ii)}>X</button>
                  </div>
                  <div style={styles.row}>
                    <label style={styles.label}>x</label>
                    <input style={styles.smallInput} type="number" value={item.x} onChange={(e) => updateItem(ri, ii, 'x', e.target.value)} />
                    <label style={styles.label}>y</label>
                    <input style={styles.smallInput} type="number" value={item.y} onChange={(e) => updateItem(ri, ii, 'y', e.target.value)} />
                    <label style={styles.label}>w</label>
                    <input style={styles.smallInput} type="number" value={item.width} onChange={(e) => updateItem(ri, ii, 'width', e.target.value)} />
                    <label style={styles.label}>h</label>
                    <input style={styles.smallInput} type="number" value={item.height} onChange={(e) => updateItem(ri, ii, 'height', e.target.value)} />
                    <label style={styles.label}>rot</label>
                    <input style={styles.smallInput} type="number" value={item.rotation || 0} onChange={(e) => updateItem(ri, ii, 'rotation', e.target.value)} title="Rotation in degrees" />
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.row}>
                    <label style={styles.label}>Item:</label>
                    <select
                      style={{ ...styles.select, flex: 1 }}
                      value={item.catalogId}
                      onChange={(e) => updateItem(ri, ii, 'catalogId', e.target.value)}
                    >
                      {sortedCatalog.length === 0
                        ? <option value="">{catalogItems.length === 0 ? 'No items in catalog' : 'No items acquired — visit the Catalog'}</option>
                        : sortedCatalog.map(ci => (
                          <option key={ci.id} value={ci.id}>{favorites.has(ci.id) ? '\u2605 ' : ''}{ci.name}</option>
                        ))}
                    </select>
                    {ii > 0 && <button style={styles.smallButton} onClick={() => moveItem(ri, ii, -1)} title="Move up (renders behind)">{'\u25B2'}</button>}
                    {ii < (room.items || []).length - 1 && <button style={styles.smallButton} onClick={() => moveItem(ri, ii, 1)} title="Move down (renders in front)">{'\u25BC'}</button>}
                    <button style={styles.smallButton} onClick={() => duplicateItem(ri, ii)} title="Duplicate">{'\u29C9'}</button>
                    <button style={styles.dangerButton} onClick={() => removeItem(ri, ii)}>X</button>
                  </div>
                  <div style={styles.row}>
                    <label style={styles.label}>Behavior:</label>
                    <select
                      style={styles.select}
                      value={item.behavior || ''}
                      onChange={(e) => updateItem(ri, ii, 'behavior', e.target.value || null)}
                    >
                      <option value="">None</option>
                      <option value="collectible">Collectible</option>
                      <option value="draggable">Draggable (resets)</option>
                      <option value="draggable-persist">Draggable (persists)</option>
                    </select>
                    <label style={{ ...styles.label, marginLeft: '12px' }}>
                      <input type="checkbox" checked={!!item.blocksMovement} onChange={(e) => updateItem(ri, ii, 'blocksMovement', e.target.checked)} />
                      {' '}Blocks movement
                    </label>
                    <label style={{ ...styles.label, marginLeft: '12px' }}>
                      <input type="checkbox" checked={!!item.skid} onChange={(e) => updateItem(ri, ii, 'skid', e.target.checked)} />
                      {' '}Skids
                    </label>
                    <label style={{ ...styles.label, marginLeft: '12px' }}>
                      <input type="checkbox" checked={!!item.gravity} onChange={(e) => updateItem(ri, ii, 'gravity', e.target.checked)} />
                      {' '}Gravity
                    </label>
                  </div>
                  <div style={styles.row}>
                    <label style={styles.label}>x</label>
                    <input style={styles.smallInput} type="number" value={item.x} onChange={(e) => updateItem(ri, ii, 'x', e.target.value)} />
                    <label style={styles.label}>y</label>
                    <input style={styles.smallInput} type="number" value={item.y} onChange={(e) => updateItem(ri, ii, 'y', e.target.value)} />
                    <label style={styles.label}>w</label>
                    <input style={styles.smallInput} type="number" value={item.width} onChange={(e) => updateItem(ri, ii, 'width', e.target.value)} />
                    <label style={styles.label}>h</label>
                    <input style={styles.smallInput} type="number" value={item.height} onChange={(e) => updateItem(ri, ii, 'height', e.target.value)} />
                    <label style={styles.label}>rot</label>
                    <input style={styles.smallInput} type="number" value={item.rotation || 0} onChange={(e) => updateItem(ri, ii, 'rotation', e.target.value)} title="Rotation in degrees" />
                  </div>
                  {item.behavior === 'collectible' && (
                    <div style={styles.row}>
                      <label style={styles.label}>Wear:</label>
                      <label style={styles.label}>offX</label>
                      <input style={{ ...styles.smallInput, width: '80px' }} type="text" inputMode="numeric" value={item.wearOffsetX} onChange={(e) => { const v = e.target.value; if (v === '' || v === '-' || !isNaN(Number(v))) updateItem(ri, ii, 'wearOffsetX', v === '' || v === '-' ? v : Number(v)); }} onBlur={(e) => updateItem(ri, ii, 'wearOffsetX', Number(e.target.value) || 0)} />
                      <label style={styles.label}>offY</label>
                      <input style={{ ...styles.smallInput, width: '80px' }} type="text" inputMode="numeric" value={item.wearOffsetY} onChange={(e) => { const v = e.target.value; if (v === '' || v === '-' || !isNaN(Number(v))) updateItem(ri, ii, 'wearOffsetY', v === '' || v === '-' ? v : Number(v)); }} onBlur={(e) => updateItem(ri, ii, 'wearOffsetY', Number(e.target.value) || 0)} />
                      <label style={styles.label}>w</label>
                      <input style={styles.smallInput} type="number" value={item.wearWidth} onChange={(e) => updateItem(ri, ii, 'wearWidth', e.target.value)} />
                      <label style={styles.label}>h</label>
                      <input style={styles.smallInput} type="number" value={item.wearHeight} onChange={(e) => updateItem(ri, ii, 'wearHeight', e.target.value)} />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          <div style={styles.row}>
            <button style={styles.smallButton} onClick={() => addItem(ri)}>+ Add Item</button>
            {ownedGames().length > 0 && (
              <button style={styles.smallButton} onClick={() => addGame(ri)}>+ Add Game</button>
            )}
            {availableGames.filter(g => g.creatorId === accountId).length > 0 && (
              <select
                style={{ ...styles.select, fontSize: '0.75rem' }}
                value=""
                onChange={(e) => { if (e.target.value) cloneGameAsItems(ri, e.target.value); }}
              >
                <option value="">Clone Game as Items...</option>
                {availableGames.filter(g => g.creatorId === accountId).map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.items.length} items)</option>
                ))}
              </select>
            )}
            <label style={styles.label}>Beginning with:</label>
            <input
              style={{ ...styles.smallInput, width: '120px' }}
              type="text"
              placeholder=""
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
            />
          </div>

          {canExportRoom(room) && (
            exportingRoom === ri ? (
              <div style={{ ...styles.exitCard, marginTop: '4px' }}>
                <strong style={{ fontSize: '0.85rem' }}>Export as Game</strong>
                <div style={styles.row}>
                  <label style={styles.label}>Name:</label>
                  <input style={{ ...styles.smallInput, width: '160px' }} type="text" value={exportName} onChange={(e) => setExportName(e.target.value)} maxLength={40} placeholder="Game name..." />
                </div>
                <div style={styles.row}>
                  <label style={styles.label}>Attribution:</label>
                  <input style={{ ...styles.smallInput, width: '160px' }} type="text" value={exportAttribution} onChange={(e) => setExportAttribution(e.target.value)} maxLength={60} placeholder="Credit / attribution..." />
                </div>
                <div style={styles.row}>
                  <label style={styles.label}>Price (Pearls):</label>
                  <input style={{ ...styles.smallInput, width: '80px' }} type="number" min="0" value={exportPrice} onChange={(e) => setExportPrice(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
                </div>
                <GameExportPreview room={room} catalogItems={catalogItems} />
                {exportError && <div style={styles.error}>{exportError}</div>}
                {exportSuccess && <div style={{ color: '#6bff6b', fontSize: '0.85rem' }}>{exportSuccess}</div>}
                <div style={styles.row}>
                  <button style={styles.smallButton} onClick={() => handleExport(ri)}>Export</button>
                  <button style={{ ...styles.smallButton, background: '#666' }} onClick={() => { setExportingRoom(null); setExportError(''); setExportSuccess(''); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button
                style={{ ...styles.smallButton, background: '#6a9f4a', marginTop: '4px' }}
                onClick={() => { setExportingRoom(ri); setExportName(''); setExportAttribution(''); setExportPrice(0); setExportError(''); setExportSuccess(''); }}
              >
                Export as Game
              </button>
            )
          )}

          <RoomPreview room={room} catalogItems={catalogItems} games={availableGames} />
        </div>
      ))}

      <button style={styles.smallButton} onClick={addRoom}>+ Add Room</button>

      {editCpId && (
        <div style={styles.field}>
          <label style={styles.label}>Party name (optional — describes this update in the party log)</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. Holiday Party, New Room Party..."
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            maxLength={60}
          />
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.buttonRow}>
        <button style={{ ...styles.button, background: '#666' }} onClick={onCancel}>Cancel</button>
        <button style={styles.button} onClick={handleSubmit}>{editCpId ? 'Party' : 'Create'}</button>
      </div>
    </div>
  );
}
