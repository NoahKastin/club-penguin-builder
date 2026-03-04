import React, { useState, useEffect } from 'react';
import fetchRetry from '../network/fetchRetry';

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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '12px',
    width: '100%',
  },
  itemCard: {
    background: '#2a2a3e',
    borderRadius: '8px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    position: 'relative',
  },
  thumbnail: {
    width: '100px',
    height: '100px',
    objectFit: 'contain',
    borderRadius: '4px',
    background: '#1a1a2e',
  },
  itemName: {
    fontSize: '0.85rem',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  uploadSection: {
    width: '100%',
    padding: '12px',
    background: '#2a2a3e',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
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
    background: '#1a1a2e',
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
  backButton: {
    padding: '8px 20px',
    fontSize: '1rem',
    borderRadius: '8px',
    border: 'none',
    background: '#666',
    color: '#fff',
    cursor: 'pointer',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '0.9rem',
  },
  success: {
    color: '#6bff6b',
    fontSize: '0.9rem',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
  },
  empty: {
    color: '#888',
    fontStyle: 'italic',
  },
  favButton: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1.1rem',
    lineHeight: 1,
    padding: '2px',
  },
  toolbar: {
    width: '100%',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchInput: {
    flex: 1,
    minWidth: '120px',
    padding: '6px 10px',
    fontSize: '0.85rem',
    borderRadius: '6px',
    border: '1px solid #555',
    background: '#1a1a2e',
    color: '#eee',
    outline: 'none',
  },
  sortSelect: {
    padding: '4px 6px',
    fontSize: '0.8rem',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#2a2a3e',
    color: '#ccc',
  },
  sortButton: {
    padding: '4px 8px',
    fontSize: '0.8rem',
    borderRadius: '4px',
    border: '1px solid #555',
    background: '#2a2a3e',
    color: '#ccc',
    cursor: 'pointer',
  },
};

export default function Catalog({ authToken, accountId, penguinName, attributionName, onBack, onPearlShop }) {
  const [tab, setTab] = useState('items'); // 'items' | 'games'
  const [items, setItems] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [attribution, setAttribution] = useState(attributionName || penguinName || '');
  const [price, setPrice] = useState(0);
  const [imageData, setImageData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [favorites, setFavorites] = useState(new Set());
  const [purchases, setPurchases] = useState(new Set());
  const [gamePurchases, setGamePurchases] = useState(new Set());
  const [balance, setBalance] = useState(0);
  const [needsPearls, setNeedsPearls] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchRetry('/api/catalog').then(r => r.json()),
      fetchRetry('/api/games').then(r => r.json()),
    ]).then(([itemData, gameData]) => {
      setItems(itemData);
      setGames(gameData);
      setLoading(false);
    }).catch(() => setLoading(false));

    if (authToken) {
      fetch('/api/auth/preferences', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(prefs => {
          if (prefs) {
            setSortField(prefs.catalog_sort_field || 'name');
            setSortDir(prefs.catalog_sort_dir || 'asc');
          }
        });
      fetch('/api/auth/favorites', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : [])
        .then(ids => setFavorites(new Set(ids)));
      fetch('/api/account/purchases', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : [])
        .then(ids => setPurchases(new Set(ids)));
      fetch('/api/account/game-purchases', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : [])
        .then(ids => setGamePurchases(new Set(ids)));
      fetch('/api/account/balance', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : { pearls: 0 })
        .then(data => setBalance(data.pearls));
    }
  }, []);

  function saveSort(field, dir) {
    setSortField(field);
    setSortDir(dir);
    if (authToken) {
      fetch('/api/auth/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ catalog_sort_field: field, catalog_sort_dir: dir }),
      });
    }
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

  function sortedAndFiltered() {
    let filtered = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(item => item.name.toLowerCase().includes(q));
    }
    const sorted = [...filtered].sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;

      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'createdAt': cmp = (a.createdAt || 0) - (b.createdAt || 0); break;
        case 'attribution': cmp = (a.attribution || '').localeCompare(b.attribution || ''); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) { setImageData(null); return; }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result);
    reader.readAsDataURL(file);
  }

  function handleUpload() {
    setError('');
    setSuccess('');
    if (!name.trim()) { setError('Name is required'); return; }
    if (!imageData) { setError('Please select an image'); return; }
    if (imageData.length > 128 * 1024) { setError('Image too large (max 128KB)'); return; }

    fetch('/api/catalog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ name: name.trim(), image: imageData, attribution: attribution.trim(), price: price || 0 }),
    })
      .then(r => r.json())
      .then(item => {
        if (item.error) { setError(item.error); return; }
        setItems([item, ...items]);
        setName('');
        setAttribution(attributionName || penguinName || '');
        setPrice(0);
        setImageData(null);
        setSuccess('Item added!');
      })
      .catch(() => setError('Upload failed'));
  }

  function handlePurchase(itemId) {
    setError('');
    setNeedsPearls(null);
    fetch(`/api/catalog/${itemId}/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          if (data.error.toLowerCase().includes('enough')) {
            setNeedsPearls(data.error);
          } else {
            setError(data.error);
          }
          return;
        }
        setPurchases(prev => new Set([...prev, itemId]));
        setBalance(data.pearls);
        setSuccess('Item purchased!');
      })
      .catch(() => setError('Purchase failed'));
  }

  function handleAcquire(itemId) {
    if (!authToken) return;
    setError('');
    fetch(`/api/catalog/${itemId}/acquire`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setPurchases(prev => new Set([...prev, itemId]));
      })
      .catch(() => setError('Acquire failed'));
  }

  function ownsItem(item) {
    if (item.uploaderId === accountId) return true; // uploader always owns
    return purchases.has(item.id);
  }

  function ownsGame(game) {
    if (game.creatorId === accountId) return true;
    return gamePurchases.has(game.id);
  }

  function handleGamePurchase(gameId) {
    setError('');
    setNeedsPearls(null);
    fetch(`/api/games/${gameId}/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          if (data.error.toLowerCase().includes('enough')) {
            setNeedsPearls(data.error);
          } else {
            setError(data.error);
          }
          return;
        }
        setGamePurchases(prev => new Set([...prev, gameId]));
        setBalance(data.pearls);
        setSuccess('Game purchased!');
      })
      .catch(() => setError('Purchase failed'));
  }

  function handleGameAcquire(gameId) {
    if (!authToken) return;
    setError('');
    fetch(`/api/games/${gameId}/acquire`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setGamePurchases(prev => new Set([...prev, gameId]));
      })
      .catch(() => setError('Acquire failed'));
  }

  function sortedAndFilteredGames() {
    let filtered = games;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(g => g.name.toLowerCase().includes(q));
    }
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'createdAt': cmp = (a.createdAt || 0) - (b.createdAt || 0); break;
        case 'attribution': cmp = (a.attribution || '').localeCompare(b.attribution || ''); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }

  const displayItems = sortedAndFiltered();
  const displayGames = sortedAndFilteredGames();

  return (
    <div style={styles.container}>
      <div style={styles.title}>Catalog</div>

      <div style={{ display: 'flex', gap: '0', width: '100%', maxWidth: '240px' }}>
        <button
          style={{ flex: 1, padding: '6px 16px', fontSize: '0.9rem', border: '1px solid #555', borderRadius: '6px 0 0 6px', cursor: 'pointer', fontWeight: 'bold', background: tab === 'items' ? '#4a90d9' : '#2a2a3e', color: tab === 'items' ? '#fff' : '#aaa' }}
          onClick={() => { setTab('items'); setError(''); setSuccess(''); }}
        >Items</button>
        <button
          style={{ flex: 1, padding: '6px 16px', fontSize: '0.9rem', border: '1px solid #555', borderRadius: '0 6px 6px 0', cursor: 'pointer', fontWeight: 'bold', background: tab === 'games' ? '#4a90d9' : '#2a2a3e', color: tab === 'games' ? '#fff' : '#aaa' }}
          onClick={() => { setTab('games'); setError(''); setSuccess(''); }}
        >Games</button>
      </div>

      {tab === 'items' && authToken && (
        <div style={styles.uploadSection}>
          <strong>Add Item</strong>
          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Item name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Attribution</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Credit / attribution..."
              value={attribution}
              onChange={(e) => setAttribution(e.target.value)}
              maxLength={60}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Price (Pearls, 0 = free)</label>
            <input
              style={{ ...styles.input, width: '100px' }}
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
            {price > 0 && <span style={{ fontSize: '0.8rem', color: '#aaa' }}>${(price * 0.05).toFixed(2)} value</span>}
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Image</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </div>
          {imageData && (
            <img src={imageData} alt="Preview" style={{ ...styles.thumbnail, width: '60px', height: '60px' }} />
          )}
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}
          <button style={styles.button} onClick={handleUpload}>Add</button>
        </div>
      )}

      <div style={styles.toolbar}>
        <input
          style={styles.searchInput}
          type="text"
          placeholder={tab === 'items' ? 'Search items...' : 'Search games...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={sortField}
          onChange={(e) => saveSort(e.target.value, sortDir)}
          style={styles.sortSelect}
        >
          <option value="name">A–Z</option>
          <option value="createdAt">Uploaded</option>
          <option value="attribution">{tab === 'items' ? 'Uploader' : 'Creator'}</option>
        </select>
        <button
          onClick={() => saveSort(sortField, sortDir === 'asc' ? 'desc' : 'asc')}
          style={styles.sortButton}
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
        </button>
      </div>

      {loading ? (
        <div style={styles.empty}>Loading...</div>
      ) : tab === 'items' ? (
        displayItems.length === 0 ? (
          <div style={styles.empty}>{search.trim() ? 'No matching items.' : 'No items in the catalog yet.'}</div>
        ) : (
          <div style={styles.grid}>
            {displayItems.map(item => (
              <div key={item.id} style={styles.itemCard}>
                {authToken && (
                  <button
                    style={styles.favButton}
                    onClick={() => toggleFavorite(item.id)}
                    title={favorites.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {favorites.has(item.id) ? '\u2605' : '\u2606'}
                  </button>
                )}
                <img src={item.image} alt={item.name} style={styles.thumbnail} />
                <div style={styles.itemName}>{item.name}</div>
                {item.attribution && <div style={{ fontSize: '0.75rem', color: '#888' }}>by {item.attribution}</div>}
                {item.price > 0 ? (
                  ownsItem(item) ? (
                    <div style={{ fontSize: '0.75rem', color: '#6bff6b' }}>Owned</div>
                  ) : (
                    <button
                      style={{ padding: '3px 10px', fontSize: '0.75rem', borderRadius: '4px', border: 'none', background: '#d9a04a', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => handlePurchase(item.id)}
                    >
                      Buy ({item.price} Pearl{item.price !== 1 ? 's' : ''})
                    </button>
                  )
                ) : ownsItem(item) ? (
                  <div style={{ fontSize: '0.75rem', color: '#6bff6b' }}>Acquired</div>
                ) : authToken ? (
                  <button
                    style={{ padding: '3px 10px', fontSize: '0.75rem', borderRadius: '4px', border: 'none', background: '#4a90d9', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                    onClick={() => handleAcquire(item.id)}
                  >
                    Acquire (Free)
                  </button>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Free</div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        displayGames.length === 0 ? (
          <div style={styles.empty}>{search.trim() ? 'No matching games.' : 'No games in the catalog yet.'}</div>
        ) : (
          <div style={styles.grid}>
            {displayGames.map(game => (
              <div key={game.id} style={styles.itemCard}>
                <div style={{ ...styles.thumbnail, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#888', textAlign: 'center', padding: '8px' }}>
                  {game.items.length} item{game.items.length !== 1 ? 's' : ''}
                </div>
                <div style={styles.itemName}>{game.name}</div>
                {game.attribution && <div style={{ fontSize: '0.75rem', color: '#888' }}>by {game.attribution}</div>}
                {game.price > 0 ? (
                  ownsGame(game) ? (
                    <div style={{ fontSize: '0.75rem', color: '#6bff6b' }}>Owned</div>
                  ) : (
                    <button
                      style={{ padding: '3px 10px', fontSize: '0.75rem', borderRadius: '4px', border: 'none', background: '#d9a04a', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => handleGamePurchase(game.id)}
                    >
                      Buy ({game.price} Pearl{game.price !== 1 ? 's' : ''})
                    </button>
                  )
                ) : ownsGame(game) ? (
                  <div style={{ fontSize: '0.75rem', color: '#6bff6b' }}>Acquired</div>
                ) : authToken ? (
                  <button
                    style={{ padding: '3px 10px', fontSize: '0.75rem', borderRadius: '4px', border: 'none', background: '#4a90d9', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
                    onClick={() => handleGameAcquire(game.id)}
                  >
                    Acquire (Free)
                  </button>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Free</div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      <button style={styles.backButton} onClick={onBack}>Back</button>

      {needsPearls && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setNeedsPearls(null)}>
          <div style={{ background: '#2a6cb8', borderRadius: '16px', border: '3px solid #6aacf8', padding: '24px 32px', maxWidth: '340px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }} onClick={e => e.stopPropagation()}>
            <div style={{ color: '#fff', fontSize: '1rem' }}>{needsPearls}</div>
            {onPearlShop && (
              <button style={{ padding: '8px 20px', fontSize: '1rem', borderRadius: '8px', border: 'none', background: '#d9a04a', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }} onClick={onPearlShop}>
                Get Pearls
              </button>
            )}
            <button style={{ padding: '6px 16px', fontSize: '0.9rem', borderRadius: '8px', border: 'none', background: '#3a5570', color: '#fff', cursor: 'pointer' }} onClick={() => setNeedsPearls(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
