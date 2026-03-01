import React, { useState, useEffect } from 'react';
import * as socket from '../network/socket';
import CreateCPForm from './CreateCPForm';
import Catalog from './Catalog';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '100%',
    overflowY: 'auto',
    padding: '8px',
  },
  logo: {
    maxWidth: '300px',
    width: '100%',
    height: 'auto',
  },
  welcome: {
    fontSize: '1.1rem',
    color: '#aaa',
  },
  list: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  listHeader: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
  },
  cpRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'stretch',
  },
  cpButton: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '1rem',
    borderRadius: '8px',
    border: '2px solid #555',
    background: '#2a2a3e',
    color: '#eee',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    padding: '8px 12px',
    fontSize: '0.85rem',
    borderRadius: '8px',
    border: '2px solid #555',
    background: '#2a2a3e',
    color: '#aaa',
    cursor: 'pointer',
  },
  roomCount: {
    fontSize: '0.85rem',
    color: '#aaa',
  },
  createButton: {
    padding: '10px 24px',
    fontSize: '1.1rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4a90d9',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  empty: {
    color: '#666',
    fontStyle: 'italic',
  },
};

export default function MainMenu({ penguinName, authToken, accountId, onSelectCP, onLogout }) {
  const [clubPenguins, setClubPenguins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCpId, setEditingCpId] = useState(null);
  const [partyLogCpId, setPartyLogCpId] = useState(null);
  const [partyLog, setPartyLog] = useState([]);
  const [showFaq, setShowFaq] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    fetch('/api/clubpenguins')
      .then(r => r.json())
      .then(cps => { setClubPenguins(cps); setLoading(false); });

    if (authToken) {
      fetch('/api/auth/preferences', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(prefs => {
          if (prefs) {
            setSortField(prefs.sort_field);
            setSortDir(prefs.sort_dir);
          }
        });
    }

    function onCreated(cp) {
      setClubPenguins(prev => {
        if (prev.some(p => p.id === cp.id)) return prev;
        return [...prev, cp];
      });
    }
    function onUpdated(cp) {
      setClubPenguins(prev => prev.map(p => p.id === cp.id ? { ...p, name: cp.name, roomCount: cp.roomCount, penguinCount: cp.penguinCount, creatorId: cp.creatorId } : p));
    }
    socket.on('clubPenguinCreated', onCreated);
    socket.on('clubPenguinUpdated', onUpdated);
    return () => {
      socket.off('clubPenguinCreated', onCreated);
      socket.off('clubPenguinUpdated', onUpdated);
    };
  }, []);

  function saveSort(field, dir) {
    setSortField(field);
    setSortDir(dir);
    if (authToken) {
      fetch('/api/auth/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ sort_field: field, sort_dir: dir }),
      });
    }
  }

  function sortedCPs() {
    const sorted = [...clubPenguins].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'createdAt': cmp = (a.createdAt || 0) - (b.createdAt || 0); break;
        case 'latestParty': cmp = (a.latestParty || 0) - (b.latestParty || 0); break;
        case 'penguinCount': cmp = (a.penguinCount || 0) - (b.penguinCount || 0); break;
        case 'roomCount': cmp = (a.roomCount || 0) - (b.roomCount || 0); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }

  if (showCatalog) {
    return <Catalog authToken={authToken} penguinName={penguinName} onBack={() => setShowCatalog(false)} />;
  }

  if (showCreate || editingCpId) {
    return (
      <CreateCPForm
        editCpId={editingCpId}
        authToken={authToken}
        onCreated={() => { setShowCreate(false); setEditingCpId(null); }}
        onCancel={() => { setShowCreate(false); setEditingCpId(null); }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <img src="/logo.svg" alt="Club Penguin Builder" style={{ ...styles.logo, filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.6))' }} />

      <div style={styles.welcome}>
        Welcome, {penguinName}!
        {authToken
          ? <button style={{ marginLeft: '12px', padding: '4px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' }} onClick={onLogout}>Log Out</button>
          : <button style={{ marginLeft: '12px', padding: '4px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' }} onClick={onLogout}>Sign Up / Log In</button>
        }
      </div>

      <div style={styles.list}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={styles.listHeader}>Choose a Club Penguin:</div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '0.8rem' }}>
            <select
              value={sortField}
              onChange={(e) => saveSort(e.target.value, sortDir)}
              style={{ padding: '2px 4px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #555', background: '#2a2a3e', color: '#ccc' }}
            >
              <option value="name">A–Z</option>
              <option value="createdAt">Created</option>
              <option value="latestParty">Latest party</option>
              <option value="penguinCount">Online</option>
              <option value="roomCount">Rooms</option>
            </select>
            <button
              onClick={() => saveSort(sortField, sortDir === 'asc' ? 'desc' : 'asc')}
              style={{ padding: '2px 6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #555', background: '#2a2a3e', color: '#ccc', cursor: 'pointer' }}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
            </button>
          </div>
        </div>
        {loading && <div style={styles.empty}>Loading...</div>}
        {!loading && clubPenguins.length === 0 && (
          <div style={styles.empty}>No Club Penguins yet!</div>
        )}
        {sortedCPs().map(cp => (
          <div key={cp.id}>
            <div style={styles.cpRow}>
              <button style={styles.cpButton} onClick={() => onSelectCP(cp)}>
                <span>{cp.name}</span>
                <span style={styles.roomCount}>{cp.roomCount} {cp.roomCount === 1 ? 'room' : 'rooms'} · {cp.penguinCount || 0} online</span>
              </button>
              <button style={styles.editButton} onClick={() => {
                if (partyLogCpId === cp.id) { setPartyLogCpId(null); return; }
                fetch(`/api/clubpenguins/${cp.id}/parties`).then(r => r.json()).then(log => {
                  setPartyLog(log);
                  setPartyLogCpId(cp.id);
                });
              }} title="Party log">
                {partyLogCpId === cp.id ? 'X' : '\u{1F389}'}
              </button>
              {accountId && accountId === cp.creatorId && <button style={styles.editButton} onClick={() => setEditingCpId(cp.id)}>Edit</button>}
            </div>
            {partyLogCpId === cp.id && (
              <div style={{ padding: '8px 16px', background: '#1a1a2e', borderRadius: '0 0 8px 8px', marginTop: '-4px', fontSize: '0.85rem' }}>
                {partyLog.length === 0
                  ? <div style={{ color: '#666', fontStyle: 'italic' }}>No parties yet</div>
                  : partyLog.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
                      <span style={{ color: '#eee' }}>{p.name}</span>
                      <span style={{ color: '#888' }}>{new Date(p.launchedAt).toLocaleDateString()}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {authToken && (
          <button style={styles.createButton} onClick={() => setShowCreate(true)}>
            Build
          </button>
        )}
        <button style={styles.createButton} onClick={() => setShowCatalog(true)}>
          Catalog
        </button>
        <button style={{ ...styles.createButton, background: '#555' }} onClick={() => setShowFaq(!showFaq)}>
          {showFaq ? 'Hide Help' : 'Help'}
        </button>
      </div>

      {showFaq && (
        <div style={{ width: '100%', padding: '16px', background: '#1a1a2e', borderRadius: '8px', fontSize: '0.9rem', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <strong>What is "a Club Penguin"?</strong>
            <div style={{ color: '#ccc' }}>A Club Penguin is a multiplayer social game; essentially a chatroom with a visual, spatial layer on top. Players walk around rooms as penguins, chat with speech bubbles, and explore. This platform lets anyone with an account create and customize his/her own.</div>
          </div>
          <div>
            <strong>Is this legal?</strong>
            <div style={{ color: '#ccc' }}>Yes. The original Club Penguin was shut down by Disney in 2017 and the trademark is not active in most regions. This is an independent, open-source platform for building new Club Penguin-style games; it does not copy or distribute any Disney assets.</div>
          </div>
          <div>
            <strong>What is a "party"?</strong>
            <div style={{ color: '#ccc' }}>When a dev edits his/her Club Penguin, the update is called a "party." Each party can have an optional name (e.g. "Holiday Party" or "New Room Party," though "Party" doesn't have to be in the name; you could just write something like "Holiday") that shows up in the party log; the 🎉 button next to each Club Penguin on the main menu.</div>
          </div>
          <div>
            <strong>What dimensions should I know for building and uploading?</strong>
            <div style={{ color: '#ccc' }}>
              Rooms are 800×600 pixels. Exits default to 100×100 pixels. All coordinates and sizes are relative to the room canvas.<br /><br />
              The penguin sprite is roughly a 40×40 pixel rectangle. Wear offsets for collectible items are relative to the penguin's center, and the default wear size is 40×40. For a full-body costume or color, use wear size 40×40 with offset (0, 0). For a hat, try a negative Y offset (e.g. 0, −15). For a pin, try offset (−15, −15) at a size like 10×10.<br /><br />
              Catalog images can be any size — they get scaled to whatever dimensions you set when placing them in a room. For room backgrounds, place an item at position (0, 0) with size 800×600.
            </div>
          </div>
          <div>
            <strong>What features are coming next?</strong>
            <div style={{ color: '#ccc' }}>See the full roadmap at <a href="https://github.com/NoahKastin/club-penguin-builder/blob/main/TODO.md" target="_blank" rel="noopener noreferrer" style={{ color: '#4a90d9' }}>TODO.md on GitHub</a>.</div>
          </div>
          <div>
            <strong>Need help or want to give feedback?</strong>
            <div style={{ color: '#ccc' }}>Join the <a href="https://discord.gg/2hnu58NPrg" target="_blank" rel="noopener noreferrer" style={{ color: '#4a90d9' }}>Discord server</a>.</div>
          </div>
        </div>
      )}
    </div>
  );
}
