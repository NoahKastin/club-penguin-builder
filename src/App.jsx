import React, { useState, useEffect } from 'react';
import NameEntry from './components/NameEntry';
import MainMenu from './components/MainMenu';
import GameView from './components/GameView';

export default function App() {
  const [penguinName, setPenguinName] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [selectedCP, setSelectedCP] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auto-login from stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setPenguinName(data.account.username);
        setAuthToken(token);
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  function handleJoin(name, token) {
    setPenguinName(name);
    setAuthToken(token || null);
  }

  function handleLogout() {
    const token = authToken || localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    }
    localStorage.removeItem('token');
    setPenguinName(null);
    setAuthToken(null);
    setSelectedCP(null);
  }

  if (loading) return null;

  if (!penguinName) {
    return <NameEntry onJoin={handleJoin} />;
  }

  if (!selectedCP) {
    return (
      <MainMenu
        penguinName={penguinName}
        authToken={authToken}
        onSelectCP={setSelectedCP}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <GameView
      penguinName={penguinName}
      authToken={authToken}
      cpId={selectedCP.id}
      onBack={() => setSelectedCP(null)}
    />
  );
}
