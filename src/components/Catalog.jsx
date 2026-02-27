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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '12px',
    width: '100%',
  },
  itemCard: {
    background: '#2a2a3e',
    borderRadius: '8px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  thumbnail: {
    width: '100px',
    height: '100px',
    objectFit: 'contain',
    borderRadius: '4px',
    background: '#1a1a2e',
  },
  itemName: {
    fontSize: '0.85rem',
    textAlign: 'center',
    wordBreak: 'break-word',
  },
  uploadSection: {
    width: '100%',
    padding: '12px',
    background: '#2a2a3e',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
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
    background: '#1a1a2e',
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
  backButton: {
    padding: '8px 20px',
    fontSize: '1rem',
    borderRadius: '8px',
    border: 'none',
    background: '#666',
    color: '#fff',
    cursor: 'pointer',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '0.9rem',
  },
  success: {
    color: '#6bff6b',
    fontSize: '0.9rem',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
  },
  empty: {
    color: '#888',
    fontStyle: 'italic',
  },
};

export default function Catalog({ authToken, penguinName, onBack }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [attribution, setAttribution] = useState(penguinName || '');
  const [imageData, setImageData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/catalog')
      .then(r => r.json())
      .then(setItems)
      .catch(() => {});
  }, []);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) { setImageData(null); return; }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result);
    reader.readAsDataURL(file);
  }

  function handleUpload() {
    setError('');
    setSuccess('');
    if (!name.trim()) { setError('Name is required'); return; }
    if (!imageData) { setError('Please select an image'); return; }
    if (imageData.length > 500 * 1024) { setError('Image too large (max ~375KB file)'); return; }

    fetch('/api/catalog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ name: name.trim(), image: imageData, attribution: attribution.trim() }),
    })
      .then(r => r.json())
      .then(item => {
        if (item.error) { setError(item.error); return; }
        setItems([item, ...items]);
        setName('');
        setAttribution(penguinName || '');
        setImageData(null);
        setSuccess('Item added!');
      })
      .catch(() => setError('Upload failed'));
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>Catalog</div>

      {authToken && (
        <div style={styles.uploadSection}>
          <strong>Add Item</strong>
          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Item name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Attribution</label>
            <input
              style={styles.input}
              type="text"
              placeholder="Credit / attribution..."
              value={attribution}
              onChange={(e) => setAttribution(e.target.value)}
              maxLength={60}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Image</label>
            <input type="file" accept="image/*" onChange={handleFileChange} />
          </div>
          {imageData && (
            <img src={imageData} alt="Preview" style={{ ...styles.thumbnail, width: '60px', height: '60px' }} />
          )}
          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.success}>{success}</div>}
          <button style={styles.button} onClick={handleUpload}>Add</button>
        </div>
      )}

      {items.length === 0 ? (
        <div style={styles.empty}>No items in the catalog yet.</div>
      ) : (
        <div style={styles.grid}>
          {items.map(item => (
            <div key={item.id} style={styles.itemCard}>
              <img src={item.image} alt={item.name} style={styles.thumbnail} />
              <div style={styles.itemName}>{item.name}</div>
              {item.attribution && <div style={{ fontSize: '0.75rem', color: '#888' }}>by {item.attribution}</div>}
            </div>
          ))}
        </div>
      )}

      <button style={styles.backButton} onClick={onBack}>Back</button>
    </div>
  );
}
