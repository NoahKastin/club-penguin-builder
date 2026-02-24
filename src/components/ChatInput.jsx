import React, { useState } from 'react';
import * as socket from '../network/socket';

const styles = {
  form: {
    display: 'flex',
    gap: '8px',
    padding: '10px',
    background: '#2a2a3e',
    borderRadius: '0 0 8px 8px',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '1rem',
    borderRadius: '6px',
    border: '1px solid #555',
    background: '#1a1a2e',
    color: '#eee',
    outline: 'none',
  },
  button: {
    padding: '8px 16px',
    fontSize: '1rem',
    borderRadius: '6px',
    border: 'none',
    background: '#4a90d9',
    color: '#fff',
    cursor: 'pointer',
  },
};

export default function ChatInput() {
  const [message, setMessage] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed) {
      socket.chat(trimmed);
      setMessage('');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        style={styles.input}
        type="text"
        placeholder="Say something..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={100}
        autoFocus
      />
      <button style={styles.button} type="submit">
        Send
      </button>
    </form>
  );
}
