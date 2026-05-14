import React, { useState, useEffect } from 'react';
import * as socket from '../network/socket';

const styles = {
  container: {
    padding: '4px 8px',
    fontSize: '0.85rem',
    color: '#aaa',
    maxHeight: '80px',
    overflowY: 'auto',
    flexShrink: 0,
  },
  header: {
    fontWeight: 'bold',
    color: '#ccc',
    marginBottom: '2px',
  },
  list: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 12px',
  },
  you: {
    color: '#4a90d9',
  },
};

export default function PlayerList() {
  const [players, setPlayers] = useState([]);
  const [localId, setLocalId] = useState(null);
  const [roomName, setRoomName] = useState('');

  useEffect(() => {
    function onRoomState(data) {
      setLocalId(data.you);
      setPlayers(data.penguins.map(p => ({ id: p.id, name: p.name })));
      setRoomName(data.room?.name?.trim() || '');
    }
    function onJoined(data) {
      setPlayers(prev => {
        if (prev.some(p => p.id === data.id)) return prev;
        return [...prev, { id: data.id, name: data.name }];
      });
    }
    function onLeft(data) {
      setPlayers(prev => prev.filter(p => p.id !== data.id));
    }

    socket.on('roomState', onRoomState);
    socket.on('penguinJoined', onJoined);
    socket.on('penguinLeft', onLeft);

    return () => {
      socket.off('roomState', onRoomState);
      socket.off('penguinJoined', onJoined);
      socket.off('penguinLeft', onLeft);
    };
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>Who's in {roomName || 'here'} ({players.length})</div>
      <div style={styles.list}>
        {players.map(p => (
          <span key={p.id} style={p.id === localId ? styles.you : undefined}>
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}
