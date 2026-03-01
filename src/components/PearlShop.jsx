import React, { useState, useEffect } from 'react';

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
  balance: {
    fontSize: '1.2rem',
    padding: '12px 24px',
    background: '#2a2a3e',
    borderRadius: '8px',
    textAlign: 'center',
  },
  bundleGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px',
    width: '100%',
  },
  bundleCard: {
    background: '#2a2a3e',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  pearlCount: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
  },
  pearlValue: {
    fontSize: '0.85rem',
    color: '#aaa',
  },
  buyButton: {
    padding: '6px 16px',
    fontSize: '0.9rem',
    borderRadius: '6px',
    border: 'none',
    background: '#4a90d9',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  backButton: {
    padding: '8px 20px',
    fontSize: '1rem',
    borderRadius: '8px',
    border: 'none',
    background: '#666',
    color: '#fff',
    cursor: 'pointer',
  },
  section: {
    width: '100%',
    padding: '12px',
    background: '#2a2a3e',
    borderRadius: '8px',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  txRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px solid #333',
    fontSize: '0.85rem',
  },
  message: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '0.9rem',
    textAlign: 'center',
  },
};

const TX_LABELS = {
  purchase: 'Bought Pearls',
  item_buy: 'Bought item',
  item_sale: 'Item sold',
};

export default function PearlShop({ authToken, onBack }) {
  const [balance, setBalance] = useState(null);
  const [bundles, setBundles] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Check for payment redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setSuccess('Payment successful! Your Pearls have been added.');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('payment') === 'cancelled') {
      setError('Payment cancelled.');
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Fetch config (bundles)
    fetch('/api/config').then(r => r.json()).then(config => {
      setBundles(config.bundles || []);
    });

    // Fetch balance
    fetch('/api/account/balance', {
      headers: { Authorization: `Bearer ${authToken}` },
    }).then(r => r.json()).then(data => {
      setBalance(data.pearls);
    });

    // Fetch transactions
    fetch('/api/account/transactions', {
      headers: { Authorization: `Bearer ${authToken}` },
    }).then(r => r.json()).then(data => {
      setTransactions(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleBuy(pearlCount) {
    setError('');
    try {
      const res = await fetch('/api/payments/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ pearls: pearlCount }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Failed to start checkout');
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>Pearl Shop</div>

      {balance !== null && (
        <div style={styles.balance}>
          You have <strong>{balance}</strong> Pearl{balance !== 1 ? 's' : ''}
          {balance > 0 && <span style={{ color: '#aaa', fontSize: '0.85rem' }}> (${(balance * 0.05).toFixed(2)} value)</span>}
        </div>
      )}

      {success && <div style={{ ...styles.message, background: '#1a3a1a', color: '#6bff6b' }}>{success}</div>}
      {error && <div style={{ ...styles.message, background: '#3a1a1a', color: '#ff6b6b' }}>{error}</div>}

      <div style={styles.section}>
        <div style={styles.sectionTitle}>Buy Pearls</div>
        <div style={styles.bundleGrid}>
          {bundles.map(b => (
            <div key={b.pearls} style={styles.bundleCard}>
              <div style={styles.pearlCount}>{b.pearls} Pearls</div>
              <div style={styles.pearlValue}>${(b.pearls * 0.05).toFixed(2)} value</div>
              <button style={styles.buyButton} onClick={() => handleBuy(b.pearls)}>
                {b.display}
              </button>
            </div>
          ))}
        </div>
      </div>

      {!loading && transactions.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Recent Transactions</div>
          {transactions.map((tx, i) => (
            <div key={i} style={styles.txRow}>
              <span style={{ color: '#ccc' }}>{TX_LABELS[tx.type] || tx.type}</span>
              <span style={{ color: tx.amount > 0 ? '#6bff6b' : '#ff6b6b', fontWeight: 'bold' }}>
                {tx.amount > 0 ? '+' : ''}{tx.amount}
              </span>
            </div>
          ))}
        </div>
      )}

      <button style={styles.backButton} onClick={onBack}>Back</button>
    </div>
  );
}
