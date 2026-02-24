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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  logoClub: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  logoPenguin: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#f1c40f',
  },
  logoBuilder: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#2ecc71',
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

export default function MainMenu({ penguinName, onSelectCP }) {
  const [clubPenguins, setClubPenguins] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCpId, setEditingCpId] = useState(null);

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
      setClubPenguins(prev => prev.map(p => p.id === cp.id ? { ...p, name: cp.name, roomCount: cp.roomCount } : p));
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
      <div style={styles.logo}>
        <span style={styles.logoClub}>Club</span>
        <span style={styles.logoPenguin}>Penguin</span>
        <span style={styles.logoBuilder}>Builder</span>
      </div>

      <div style={styles.welcome}>Welcome, {penguinName}!</div>

      <div style={styles.list}>
        <div style={styles.listHeader}>Choose a Club Penguin:</div>
        {clubPenguins.length === 0 && (
          <div style={styles.empty}>No Club Penguins yet!</div>
        )}
        {clubPenguins.map(cp => (
          <div key={cp.id} style={styles.cpRow}>
            <button style={styles.cpButton} onClick={() => onSelectCP(cp)}>
              <span>{cp.name}</span>
              <span style={styles.roomCount}>{cp.roomCount} {cp.roomCount === 1 ? 'room' : 'rooms'}</span>
            </button>
            <button style={styles.editButton} onClick={() => setEditingCpId(cp.id)}>Edit</button>
          </div>
        ))}
      </div>

      <button style={styles.createButton} onClick={() => setShowCreate(true)}>
        Create Club Penguin
      </button>
    </div>
  );
}
