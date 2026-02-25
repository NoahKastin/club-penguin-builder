import React, { useState } from 'react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  form: {
    display: 'flex',
    gap: '10px',
  },
  input: {
    padding: '10px 16px',
    fontSize: '1.1rem',
    borderRadius: '8px',
    border: '2px solid #555',
    background: '#2a2a3e',
    color: '#eee',
    outline: 'none',
  },
  button: {
    padding: '10px 24px',
    fontSize: '1.1rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4a90d9',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};

export default function NameEntry({ onJoin }) {
  const [name, setName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onJoin(trimmed);
    }
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
          <img src="/logo.svg" alt="Club Penguin Builder" style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            <input
              style={{ ...styles.input, flex: 1, minWidth: 0 }}
              type="text"
              placeholder="Penguin name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <button style={styles.button} type="submit">
              Play
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
