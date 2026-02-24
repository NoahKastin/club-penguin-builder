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

// editCpId: if set, we're editing an existing CP
export default function CreateCPForm({ editCpId, onCreated, onCancel }) {
  const [cpName, setCpName] = useState('');
  const [rooms, setRooms] = useState([
    { tempId: 'room_1', name: 'Lobby', bgColor: '#333333', spawn: true, exits: [] },
  ]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!editCpId);

  useEffect(() => {
    if (!editCpId) return;
    fetch(`/api/clubpenguins/${editCpId}`)
      .then(r => r.json())
      .then(cp => {
        setCpName(cp.name);
        const roomList = Object.values(cp.rooms).map(r => ({
          tempId: r.id,
          name: r.name,
          bgColor: r.bgColor,
          spawn: r.spawn,
          exits: (r.exits || []).map(e => ({
            targetRoom: e.targetRoom,
            label: e.label,
            x: e.x,
            y: e.y,
            width: e.width,
            height: e.height,
          })),
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
    setRooms([...rooms, { tempId: makeRoomId(), name: '', bgColor: '#333333', spawn: false, exits: [] }]);
  }

  function removeRoom(index) {
    if (rooms.length <= 1) return;
    const removed = rooms[index];
    const updated = rooms.filter((_, i) => i !== index);
    if (removed.spawn && updated.length > 0) {
      updated[0] = { ...updated[0], spawn: true };
    }
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
    if (field === 'spawn' && value) {
      for (let i = 0; i < updated.length; i++) {
        if (i !== index) updated[i] = { ...updated[i], spawn: false };
      }
    }
    setRooms(updated);
  }

  function addExit(roomIndex) {
    const updated = [...rooms];
    const otherRooms = rooms.filter((_, i) => i !== roomIndex);
    const defaultTarget = otherRooms.length > 0 ? otherRooms[0].tempId : '';
    updated[roomIndex] = {
      ...updated[roomIndex],
      exits: [...updated[roomIndex].exits, { targetRoom: defaultTarget, label: '', x: 10, y: 200, width: 80, height: 120 }],
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

    const roomsObj = {};
    for (const room of rooms) {
      roomsObj[room.tempId] = {
        id: room.tempId,
        name: room.name.trim(),
        bgColor: room.bgColor,
        spawn: room.spawn,
        exits: room.exits.map(e => ({
          targetRoom: e.targetRoom,
          label: e.label || rooms.find(r => r.tempId === e.targetRoom)?.name || e.targetRoom,
          x: e.x,
          y: e.y,
          width: e.width,
          height: e.height,
        })),
      };
    }

    if (editCpId) {
      socket.editClubPenguin({ id: editCpId, name: cpName.trim(), rooms: roomsObj }, (response) => {
        if (response.success) {
          onCreated(response.cp);
        } else {
          setError(response.error || 'Failed to update');
        }
      });
    } else {
      socket.createClubPenguin({ name: cpName.trim(), rooms: roomsObj }, (response) => {
        if (response.success) {
          onCreated(response.cp);
        } else {
          setError(response.error || 'Failed to create');
        }
      });
    }
  }

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

      {rooms.map((room, ri) => (
        <div key={room.tempId} style={styles.roomCard}>
          <div style={styles.roomHeader}>
            <strong>Room {ri + 1}</strong>
            <div style={styles.row}>
              <label style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={room.spawn}
                  onChange={() => updateRoom(ri, 'spawn', true)}
                />{' '}
                Spawn
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
        </div>
      ))}

      <button style={styles.smallButton} onClick={addRoom}>+ Add Room</button>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.buttonRow}>
        <button style={{ ...styles.button, background: '#666' }} onClick={onCancel}>Cancel</button>
        <button style={styles.button} onClick={handleSubmit}>{editCpId ? 'Save' : 'Create'}</button>
      </div>
    </div>
  );
}
