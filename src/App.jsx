import React, { useState, useEffect } from 'react';
import NameEntry from './components/NameEntry';
import MainMenu from './components/MainMenu';
import GameView from './components/GameView';
import { setAuthToken as setSocketAuthToken } from './network/socket';
import fetchRetry from './network/fetchRetry';

export default function App() {
  const [penguinName, setPenguinName] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [accountId, setAccountId] = useState(null);
  const [attributionName, setAttributionName] = useState('');
  const [selectedCP, setSelectedCP] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auto-login from stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    fetchRetry('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setPenguinName(data.account.username);
        setAuthToken(token);
        setAccountId(data.account.id);
        setAttributionName(data.account.attribution_name || '');
        setSocketAuthToken(token);
      })
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  function handleJoin(name, token, acctId, attrName) {
    setPenguinName(name);
    setAuthToken(token || null);
    setAccountId(acctId || null);
    setAttributionName(attrName || '');
    setSocketAuthToken(token || null);
  }

  function handleLogout() {
    const token = authToken || localStorage.getItem('token');
    if (token) {
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    }
    localStorage.removeItem('token');
    setPenguinName(null);
    setAuthToken(null);
    setAccountId(null);
    setAttributionName('');
    setSocketAuthToken(null);
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
        accountId={accountId}
        attributionName={attributionName}
        onAttributionNameChange={setAttributionName}
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
