import React, { useState } from 'react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
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
      <div style={styles.title}>Club Penguin Builder</div>
      <div style={{ fontSize: '4rem' }}>🐧</div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          style={styles.input}
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
      </form>
    </div>
  );
}
