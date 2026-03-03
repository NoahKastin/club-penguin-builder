import React, { useState, useEffect } from 'react';
import * as socket from '../network/socket';
import fetchRetry from '../network/fetchRetry';
import CreateCPForm from './CreateCPForm';
import Catalog from './Catalog';
import PearlShop from './PearlShop';

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
    maxWidth: '300px',
    width: '100%',
    height: 'auto',
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

export default function MainMenu({ penguinName, authToken, accountId, attributionName, onAttributionNameChange, onSelectCP, onLogout }) {
  const [clubPenguins, setClubPenguins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCpId, setEditingCpId] = useState(null);
  const [partyLogCpId, setPartyLogCpId] = useState(null);
  const [partyLog, setPartyLog] = useState([]);
  const [showFaq, setShowFaq] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showPearlShop, setShowPearlShop] = useState(false);
  const [pearlBalance, setPearlBalance] = useState(null);
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [editingAttribution, setEditingAttribution] = useState(false);
  const [attrDraft, setAttrDraft] = useState('');

  useEffect(() => {
    // Auto-open Pearl Fishery on Stripe redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') && authToken) {
      setShowPearlShop(true);
    }

    fetchRetry('/api/clubpenguins')
      .then(r => r.json())
      .then(cps => { setClubPenguins(cps); setLoading(false); });

    if (authToken) {
      fetch('/api/auth/preferences', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(prefs => {
          if (prefs) {
            setSortField(prefs.sort_field);
            setSortDir(prefs.sort_dir);
          }
        });
      fetch('/api/account/balance', { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setPearlBalance(data.pearls); });
    }

    function onCreated(cp) {
      setClubPenguins(prev => {
        if (prev.some(p => p.id === cp.id)) return prev;
        return [...prev, cp];
      });
    }
    function onUpdated(cp) {
      setClubPenguins(prev => prev.map(p => p.id === cp.id ? { ...p, name: cp.name, roomCount: cp.roomCount, penguinCount: cp.penguinCount, creatorId: cp.creatorId } : p));
    }
    socket.on('clubPenguinCreated', onCreated);
    socket.on('clubPenguinUpdated', onUpdated);
    return () => {
      socket.off('clubPenguinCreated', onCreated);
      socket.off('clubPenguinUpdated', onUpdated);
    };
  }, []);

  function saveSort(field, dir) {
    setSortField(field);
    setSortDir(dir);
    if (authToken) {
      fetch('/api/auth/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ sort_field: field, sort_dir: dir }),
      });
    }
  }

  function sortedCPs() {
    const sorted = [...clubPenguins].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'createdAt': cmp = (a.createdAt || 0) - (b.createdAt || 0); break;
        case 'latestParty': cmp = (a.latestParty || 0) - (b.latestParty || 0); break;
        case 'penguinCount': cmp = (a.penguinCount || 0) - (b.penguinCount || 0); break;
        case 'roomCount': cmp = (a.roomCount || 0) - (b.roomCount || 0); break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return sorted;
  }

  if (showPearlShop) {
    return <PearlShop authToken={authToken} onBack={() => { setShowPearlShop(false); /* refresh balance */ if (authToken) fetch('/api/account/balance', { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.ok ? r.json() : null).then(data => { if (data) setPearlBalance(data.pearls); }); }} />;
  }

  if (showCatalog) {
    return <Catalog authToken={authToken} accountId={accountId} penguinName={penguinName} attributionName={attributionName} onBack={() => setShowCatalog(false)} onPearlShop={() => { setShowCatalog(false); setShowPearlShop(true); }} />;
  }

  if (showCreate || editingCpId) {
    return (
      <CreateCPForm
        editCpId={editingCpId}
        authToken={authToken}
        accountId={accountId}
        onCreated={() => { setShowCreate(false); setEditingCpId(null); }}
        onCancel={() => { setShowCreate(false); setEditingCpId(null); }}
      />
    );
  }

  return (
    <div style={styles.container}>
      <img src="/logo.svg" alt="Club Penguin Builder" style={{ ...styles.logo, filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.6))', transform: 'translateZ(0)' }} />

      <div style={styles.welcome}>
        Welcome, {penguinName}!
        {authToken && pearlBalance !== null && (
          <button
            style={{ marginLeft: '8px', padding: '4px 10px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #d9a04a', background: 'transparent', color: '#d9a04a', cursor: 'pointer' }}
            onClick={() => setShowPearlShop(true)}
            title="Pearl Fishery"
          >
            {pearlBalance} Pearl{pearlBalance !== 1 ? 's' : ''}
          </button>
        )}
        {authToken
          ? <button style={{ marginLeft: '8px', padding: '4px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' }} onClick={onLogout}>Log Out</button>
          : <button style={{ marginLeft: '8px', padding: '4px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' }} onClick={onLogout}>Sign Up / Log In</button>
        }
      </div>

      {authToken && (
        <div style={{ fontSize: '0.85rem', color: '#888', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {editingAttribution ? (
            <>
              <span>Attribution name:</span>
              <input
                style={{ padding: '3px 8px', fontSize: '0.85rem', borderRadius: '4px', border: '1px solid #555', background: '#1a1a2e', color: '#eee', outline: 'none', width: '160px' }}
                type="text"
                value={attrDraft}
                onChange={(e) => setAttrDraft(e.target.value)}
                maxLength={60}
                placeholder={penguinName}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    fetch('/api/auth/attribution-name', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                      body: JSON.stringify({ attributionName: attrDraft.trim() }),
                    });
                    onAttributionNameChange(attrDraft.trim());
                    setEditingAttribution(false);
                  } else if (e.key === 'Escape') {
                    setEditingAttribution(false);
                  }
                }}
              />
              <button
                style={{ padding: '3px 8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #555', background: '#4a90d9', color: '#fff', cursor: 'pointer' }}
                onClick={() => {
                  fetch('/api/auth/attribution-name', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ attributionName: attrDraft.trim() }),
                  });
                  onAttributionNameChange(attrDraft.trim());
                  setEditingAttribution(false);
                }}
              >Save</button>
              <button
                style={{ padding: '3px 8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' }}
                onClick={() => setEditingAttribution(false)}
              >Cancel</button>
            </>
          ) : (
            <>
              <span>Uploads credited to: <strong style={{ color: '#ccc' }}>{attributionName || penguinName}</strong></span>
              <button
                style={{ padding: '2px 8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #555', background: 'transparent', color: '#aaa', cursor: 'pointer' }}
                onClick={() => { setAttrDraft(attributionName || ''); setEditingAttribution(true); }}
              >Edit</button>
            </>
          )}
        </div>
      )}

      <div style={styles.list}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={styles.listHeader}>Choose a Club Penguin:</div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '0.8rem' }}>
            <select
              value={sortField}
              onChange={(e) => saveSort(e.target.value, sortDir)}
              style={{ padding: '2px 4px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #555', background: '#2a2a3e', color: '#ccc' }}
            >
              <option value="name">A–Z</option>
              <option value="createdAt">Created</option>
              <option value="latestParty">Latest party</option>
              <option value="penguinCount">Online</option>
              <option value="roomCount">Rooms</option>
            </select>
            <button
              onClick={() => saveSort(sortField, sortDir === 'asc' ? 'desc' : 'asc')}
              style={{ padding: '2px 6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #555', background: '#2a2a3e', color: '#ccc', cursor: 'pointer' }}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDir === 'asc' ? '\u25B2' : '\u25BC'}
            </button>
          </div>
        </div>
        {loading && <div style={styles.empty}>Loading...</div>}
        {!loading && clubPenguins.length === 0 && (
          <div style={styles.empty}>No Club Penguins yet!</div>
        )}
        {sortedCPs().map(cp => (
          <div key={cp.id}>
            <div style={styles.cpRow}>
              <button style={styles.cpButton} onClick={() => onSelectCP(cp)}>
                <span>{cp.name}</span>
                <span style={styles.roomCount}>{cp.roomCount} {cp.roomCount === 1 ? 'room' : 'rooms'} · {cp.penguinCount || 0} online</span>
              </button>
              <button style={styles.editButton} onClick={() => {
                if (partyLogCpId === cp.id) { setPartyLogCpId(null); return; }
                fetch(`/api/clubpenguins/${cp.id}/parties`).then(r => r.json()).then(log => {
                  setPartyLog(log);
                  setPartyLogCpId(cp.id);
                });
              }} title="Party log">
                {partyLogCpId === cp.id ? 'X' : '\u{1F389}'}
              </button>
              {accountId && accountId === cp.creatorId && <button style={styles.editButton} onClick={() => setEditingCpId(cp.id)}>Edit</button>}
            </div>
            {partyLogCpId === cp.id && (
              <div style={{ padding: '8px 16px', background: '#1a1a2e', borderRadius: '0 0 8px 8px', marginTop: '-4px', fontSize: '0.85rem' }}>
                {partyLog.length === 0
                  ? <div style={{ color: '#666', fontStyle: 'italic' }}>No parties yet</div>
                  : partyLog.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #333' }}>
                      <span style={{ color: '#eee' }}>{p.name}</span>
                      <span style={{ color: '#888' }}>{new Date(p.launchedAt).toLocaleDateString()}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        {authToken && (
          <button style={styles.createButton} onClick={() => setShowCreate(true)}>
            Build
          </button>
        )}
        <button style={styles.createButton} onClick={() => setShowCatalog(true)}>
          Catalog
        </button>
        <button style={{ ...styles.createButton, background: '#555' }} onClick={() => setShowFaq(!showFaq)}>
          {showFaq ? 'Hide Help' : 'Help'}
        </button>
      </div>

      {showFaq && (
        <div style={{ width: '100%', padding: '16px', background: '#1a1a2e', borderRadius: '8px', fontSize: '0.9rem', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <strong>What is "a Club Penguin"?</strong>
            <div style={{ color: '#ccc' }}>A Club Penguin is a multiplayer social game; essentially a chatroom with a visual, spatial layer on top. Players walk around rooms as penguins, chat with speech bubbles, and explore. This platform lets anyone with an account create and customize their own.</div>
          </div>
          <div>
            <strong>Is this legal?</strong>
            <div style={{ color: '#ccc' }}>Yes. The original Club Penguin was shut down by Disney in 2017 and the trademark is not active in most regions. This is an independent, open-source platform for building new Club Penguin-style games; it does not copy or distribute any Disney assets.</div>
          </div>
          <div>
            <strong>What is a "party"?</strong>
            <div style={{ color: '#ccc' }}>When a party planner edits their Club Penguin, the update is called a "party." Each party can have an optional name (e.g. "Holiday Party" or "New Room Party," though "Party" doesn't have to be in the name; you could just write something like "Holiday") that shows up in the party log; the 🎉 button next to each Club Penguin on the main menu.</div>
          </div>
          <div>
            <strong>What are Pearls?</strong>
            <div style={{ color: '#ccc' }}>Pearls are the platform's currency. You can buy Pearl bundles via Stripe in the Pearl Fishery, then spend them on priced items in the Catalog. When someone buys an item you uploaded, you earn Pearls from the sale. If you've earned Pearls, you can cash them out to real money by setting up a payout account through Stripe Connect in the Pearl Fishery.</div>
          </div>
          <div>
            <strong>What dimensions should I know for building and uploading?</strong>
            <div style={{ color: '#ccc' }}>
              Rooms are 800×600 pixels. Exits default to 100×100 pixels. All coordinates and sizes are relative to the room canvas.<br /><br />
              The penguin sprite is roughly a 40×40 pixel rectangle. Wear offsets for collectible items are relative to the penguin's center, and the default wear size is 40×40. For a full-body costume or color, use wear size 40×40 with offset (0, 0). For a hat, try a negative Y offset (e.g. 0, −15). For a pin, try offset (−15, −15) at a size like 10×10.<br /><br />
              Catalog images can be any size — they get scaled to whatever dimensions you set when placing them in a room. For room backgrounds, place an item at position (0, 0) with size 800×600.
            </div>
          </div>
          <div>
            <strong>What features are coming next?</strong>
            <div style={{ color: '#ccc' }}>See the full roadmap at <a href="https://github.com/NoahKastin/club-penguin-builder/blob/main/TODO.md" target="_blank" rel="noopener noreferrer" style={{ color: '#4a90d9' }}>TODO.md on GitHub</a>.</div>
          </div>
          <div>
            <strong>Need help or want to give feedback?</strong>
            <div style={{ color: '#ccc' }}>Join the <a href="https://discord.gg/2hnu58NPrg" target="_blank" rel="noopener noreferrer" style={{ color: '#4a90d9' }}>Discord server</a>.</div>
          </div>
          <div style={{ borderTop: '1px solid #333', paddingTop: '12px', marginTop: '4px' }}>
            <strong>Terms of Service</strong>
            <div style={{ color: '#ccc' }}>
              By creating an account or using Club Penguin Builder ("the Platform"), you agree to these terms. You are responsible for keeping your account credentials secure. You must be at least 13 years old to use the Platform.<br /><br />
              When you upload images to the Catalog, you represent that you own the content or have the rights to share it. Uploads are reviewed by automated AI moderation. The Platform may remove content that violates these terms. By uploading, you grant the Platform a license to display and distribute your content within the Platform.<br /><br />
              Pearls are a virtual currency that can be purchased via Stripe, earned by selling catalog items, and spent on catalog items. Pearls have no cash value unless withdrawn through Stripe Connect. Pearl purchases are non-refundable. The Platform may adjust Pearl pricing or availability at any time.<br /><br />
              You may not upload or facilitate content that is illegal, infringes on intellectual property, violates <a href="https://stripe.com/legal/restricted-businesses" target="_blank" rel="noopener noreferrer" style={{ color: '#4a90d9' }}>Stripe's Restricted Businesses policy</a>, or constitutes harassment or hate speech. Violations may result in account suspension without refund.<br /><br />
              The Platform is provided "as is" without warranties of any kind. To the fullest extent permitted by law, the Platform and its operators are not liable for any indirect, incidental, or consequential damages. The Platform is not available in Canada or the United Kingdom due to trademark considerations. These terms may be updated at any time; continued use constitutes acceptance. Source code is available under <a href="https://github.com/NoahKastin/club-penguin-builder" target="_blank" rel="noopener noreferrer" style={{ color: '#4a90d9' }}>CC-BY 4.0</a>.
            </div>
          </div>
          <div>
            <strong>Privacy Policy</strong>
            <div style={{ color: '#ccc' }}>
              We collect your username, a bcrypt-hashed password (never stored in plaintext), content you upload, and Pearl transaction history. We do not collect your email address or any other personal contact information. We do not use cookies, tracking pixels, or analytics. Authentication state is stored in your browser's localStorage as a session token.<br /><br />
              Your data is used solely to operate the Platform: authentication, content display, and payment processing. Third-party services: <strong>Stripe</strong> processes payments and payouts (their privacy policy applies); <strong>OpenAI</strong> and <strong>Anthropic</strong> review uploads for content moderation.<br /><br />
              Your data is retained as long as your account exists. To request deletion, contact the Platform operator. Passwords are hashed with bcrypt and never stored in plaintext. The Platform is not directed at children under 13.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
