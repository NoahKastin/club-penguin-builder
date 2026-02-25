import React, { useState } from 'react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    width: '320px',
    maxWidth: '100%',
  },
  logo: {
    width: '100%',
    height: 'auto',
  },
  tabs: {
    display: 'flex',
    gap: '0',
    width: '100%',
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    fontSize: '0.95rem',
    border: '2px solid #555',
    background: '#1a1a2e',
    color: '#888',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  activeTab: {
    flex: 1,
    padding: '8px 0',
    fontSize: '0.95rem',
    border: '2px solid #4a90d9',
    background: '#2a2a3e',
    color: '#eee',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    width: '100%',
  },
  input: {
    padding: '10px 16px',
    fontSize: '1.1rem',
    borderRadius: '8px',
    border: '2px solid #555',
    background: '#2a2a3e',
    color: '#eee',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
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
    width: '100%',
  },
  error: {
    color: '#e74c3c',
    fontSize: '0.9rem',
  },
};

export default function NameEntry({ onJoin }) {
  const [tab, setTab] = useState('guest');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleGuest(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onJoin(trimmed, null, null);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem('token', data.token);
      onJoin(data.account.username, data.token, data.account.id);
    } catch { setError('Connection failed'); }
    finally { setLoading(false); }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      localStorage.setItem('token', data.token);
      onJoin(data.account.username, data.token, data.account.id);
    } catch { setError('Connection failed'); }
    finally { setLoading(false); }
  }

  const tabStyle = (t) => t === tab ? { ...styles.activeTab, borderRadius: t === 'guest' ? '8px 0 0 8px' : t === 'register' ? '0 8px 8px 0' : '0' } : { ...styles.tab, borderRadius: t === 'guest' ? '8px 0 0 8px' : t === 'register' ? '0 8px 8px 0' : '0' };

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        <img src="/logo.svg" alt="Club Penguin Builder" style={styles.logo} />

        <div style={styles.tabs}>
          <button style={tabStyle('guest')} onClick={() => { setTab('guest'); setError(''); }}>Guest</button>
          <button style={tabStyle('login')} onClick={() => { setTab('login'); setError(''); }}>Log In</button>
          <button style={tabStyle('register')} onClick={() => { setTab('register'); setError(''); }}>Register</button>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#888', textAlign: 'center' }}>
          {tab === 'guest' ? 'Jump in and play! Create an account to build your own Club Penguin.' : 'Accounts can create and manage Club Penguins.'}
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {tab === 'guest' && (
          <form onSubmit={handleGuest} style={styles.form}>
            <input
              style={styles.input}
              type="text"
              placeholder="Penguin name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <button style={styles.button} type="submit">Play</button>
          </form>
        )}

        {tab === 'login' && (
          <form onSubmit={handleLogin} style={styles.form}>
            <input
              style={styles.input}
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister} style={styles.form}>
            <input
              style={styles.input}
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
