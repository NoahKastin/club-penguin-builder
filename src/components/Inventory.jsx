import React, { useState, useEffect } from 'react';
import * as socket from '../network/socket';

const styles = {
  container: {
    padding: '8px',
    background: '#2a2a3e',
    borderRadius: '6px',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  title: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    color: '#ccc',
  },
  toggleButton: {
    padding: '2px 8px',
    fontSize: '0.8rem',
    borderRadius: '4px',
    border: '1px solid #555',
    background: 'transparent',
    color: '#aaa',
    cursor: 'pointer',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  item: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  itemImage: {
    width: '32px',
    height: '32px',
    objectFit: 'contain',
  },
  wornBadge: {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#4a90d9',
    border: '1px solid #fff',
  },
  empty: {
    color: '#666',
    fontSize: '0.8rem',
    fontStyle: 'italic',
  },
  toolbar: {
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    marginBottom: '6px',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '80px',
    padding: '3px 6px',
    fontSize: '0.75rem',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#1a1a2e',
    color: '#eee',
    outline: 'none',
  },
  sortSelect: {
    padding: '2px 4px',
    fontSize: '0.75rem',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#1a1a2e',
    color: '#ccc',
  },
  sortButton: {
    padding: '2px 4px',
    fontSize: '0.75rem',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#1a1a2e',
    color: '#ccc',
    cursor: 'pointer',
  },
  favBadge: {
    position: 'absolute',
    top: '-2px',
    left: '-2px',
    fontSize: '0.55rem',
    lineHeight: 1,
    color: '#ffd700',
  },
};

export default function Inventory({ authToken }) {
  const [inventory, setInventory] = useState([]);
  const [clothes, setClothes] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [favorites, setFavorites] = useState(new Set());
  const [hideEmoji, setHideEmoji] = useState(false);

  useEffect(() => {
    function onRoomState(data) {
      if (data.inventory && data.inventory.length > 0) {
        setInventory(data.inventory);
        setClothes(data.clothes || []);
      }
    }
    function onItemCollected(data) {
      setInventory(data.inventory || []);
    }
    function onInventoryUpdated(data) {
      setInventory(data.inventory || []);
      setClothes(data.clothes || []);
    }

    function onHideEmojiUpdated(data) {
      setHideEmoji(data.hideEmoji);
    }

    socket.on('roomState', onRoomState);
    socket.on('itemCollected', onItemCollected);
    socket.on('inventoryUpdated', onInventoryUpdated);
    socket.on('hideEmojiUpdated', onHideEmojiUpdated);

    if (authToken) {
      fetch('/api/auth/preferences', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(prefs => {
          if (prefs) {
            setSortField(prefs.inv_sort_field || 'name');
            setSortDir(prefs.inv_sort_dir || 'asc');
            setHideEmoji(!!prefs.hide_emoji);
          }
        });
      fetch('/api/auth/favorites', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : [])
        .then(ids => setFavorites(new Set(ids)));
    }

    return () => {
      socket.off('roomState', onRoomState);
      socket.off('itemCollected', onItemCollected);
      socket.off('inventoryUpdated', onInventoryUpdated);
      socket.off('hideEmojiUpdated', onHideEmojiUpdated);
    };
  }, []);

  function saveSort(field, dir) {
    setSortField(field);
    setSortDir(dir);
    if (authToken) {
      fetch('/api/auth/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ inv_sort_field: field, inv_sort_dir: dir }),
      });
    }
  }

  function toggleHideEmoji() {
    const next = !hideEmoji;
    setHideEmoji(next);
    socket.setHideEmoji(next);
  }

  function toggleFavorite(catalogId) {
    if (!authToken) return;
    fetch(`/api/auth/favorites/${catalogId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(data => {
        setFavorites(prev => {
          const next = new Set(prev);
          if (data.favorited) next.add(catalogId);
          else next.delete(catalogId);
          return next;
        });
      });
  }

  function isWorn(invIndex) {
    const invItem = inventory[invIndex];
    return clothes.some(c => c === invItem || (c.catalogId === invItem.catalogId && c.wearOffsetX === invItem.wearOffsetX && c.wearOffsetY === invItem.wearOffsetY));
  }

  function toggleItem(invIndex) {
    if (isWorn(invIndex)) {
      const invItem = inventory[invIndex];
      const clothesIdx = clothes.findIndex(c => c === invItem || (c.catalogId === invItem.catalogId && c.wearOffsetX === invItem.wearOffsetX && c.wearOffsetY === invItem.wearOffsetY));
      if (clothesIdx >= 0) {
        socket.unequipItem(clothesIdx);
      }
    } else {
      socket.equipItem(invIndex);
    }
  }

  // Build a sorted/filtered view with original indices preserved
  function getSortedItems() {
    let indexed = inventory.map((item, i) => ({ item, origIndex: i }));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      indexed = indexed.filter(({ item }) => (item.name || '').toLowerCase().includes(q));
    }
    indexed.sort((a, b) => {
      const aFav = favorites.has(a.item.catalogId) ? 0 : 1;
      const bFav = favorites.has(b.item.catalogId) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;

      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = (a.item.name || '').localeCompare(b.item.name || ''); break;
        case 'createdAt': cmp = (a.item.collectedAt || 0) - (b.item.collectedAt || 0); break;
        case 'attribution': cmp = (a.item.attribution || '').localeCompare(b.item.attribution || ''); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return indexed;
  }

  if (inventory.length === 0) return null;

  const sortedItems = getSortedItems();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Items ({inventory.length})</div>
        <button style={styles.toggleButton} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>
      {!collapsed && (
        <>
          <div style={styles.toolbar}>
            <input
              style={styles.searchInput}
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              value={sortField}
              onChange={(e) => saveSort(e.target.value, sortDir)}
              style={styles.sortSelect}
            >
              <option value="name">A–Z</option>
              <option value="createdAt">Collected</option>
              <option value="attribution">Creator</option>
            </select>
            <button
              onClick={() => saveSort(sortField, sortDir === 'asc' ? 'desc' : 'asc')}
              style={styles.sortButton}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
            </button>
            <button
              onClick={toggleHideEmoji}
              style={{
                ...styles.sortButton,
                background: hideEmoji ? '#3a5a3e' : '#1a1a2e',
                border: hideEmoji ? '1px solid #4a90d9' : '1px solid #555',
              }}
              title={hideEmoji ? 'Show penguin emoji' : 'Hide penguin emoji'}
            >
              {hideEmoji ? '\u{1F427}\u{274C}' : '\u{1F427}'}
            </button>
          </div>
          <div style={styles.grid}>
            {sortedItems.map(({ item, origIndex }) => {
              const worn = isWorn(origIndex);
              const isFav = favorites.has(item.catalogId);
              return (
                <div
                  key={origIndex}
                  style={{
                    ...styles.item,
                    background: worn ? '#3a5a3e' : '#1a1a2e',
                    border: worn ? '2px solid #4a90d9' : '2px solid #444',
                  }}
                  onClick={() => toggleItem(origIndex)}
                  onContextMenu={(e) => { e.preventDefault(); toggleFavorite(item.catalogId); }}
                  title={`${item.name || item.catalogId}${worn ? ' (worn — click to remove)' : ' (click to wear)'}${authToken ? ' · right-click to favorite' : ''}`}
                >
                  <img src={item.image} alt={item.name} style={styles.itemImage} />
                  {worn && <div style={styles.wornBadge} />}
                  {isFav && <div style={styles.favBadge}>{'\u2605'}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
