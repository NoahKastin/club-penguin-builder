import React, { useState, useEffect } from 'react';
import * as socket from '../network/socket';
import CreateCPForm from './CreateCPForm';

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
  const [showCreate, setShowCreate] = useState(false);
  const [editingCpId, setEditingCpId] = useState(null);
  const [partyLogCpId, setPartyLogCpId] = useState(null);
  const [partyLog, setPartyLog] = useState([]);

  useEffect(() => {
    fetch('/api/clubpenguins')
      .then(r => r.json())
      .then(setClubPenguins);

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

  if (showCreate || editingCpId) {
    return (
      <CreateCPForm
        editCpId={editingCpId}
        onCreated={() => { setShowCreate(false); setEditingCpId(null); }}
        onCancel={() => { setShowCreate(false); setEditingCpId(null); }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <img src="/logo.svg" alt="Club Penguin Builder" style={styles.logo} />

      <div style={styles.welcome}>
        Welcome, {penguinName}!
        {authToken
          ? <button style={{ marginLeft: '12px', padding: '4px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' }} onClick={onLogout}>Log Out</button>
          : <button style={{ marginLeft: '12px', padding: '4px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' }} onClick={onLogout}>Sign Up / Log In</button>
        }
      </div>

      <div style={styles.list}>
        <div style={styles.listHeader}>Choose a Club Penguin:</div>
        {clubPenguins.length === 0 && (
          <div style={styles.empty}>No Club Penguins yet!</div>
        )}
        {clubPenguins.map(cp => (
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

      {authToken && (
        <button style={styles.createButton} onClick={() => setShowCreate(true)}>
          Create Club Penguin
        </button>
      )}
    </div>
  );
}
