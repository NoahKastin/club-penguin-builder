import React, { useState, useEffect } from 'react';
import * as socket from '../network/socket';

const styles = {
  container: {
    padding: '8px',
    background: '#2a2a3e',
    borderRadius: '6px',
    maxHeight: '150px',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
  },
  title: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    color: '#ccc',
  },
  toggleButton: {
    padding: '2px 8px',
    fontSize: '0.8rem',
    borderRadius: '4px',
    border: '1px solid #555',
    background: 'transparent',
    color: '#aaa',
    cursor: 'pointer',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  item: {
    width: '40px',
    height: '40px',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  itemImage: {
    width: '32px',
    height: '32px',
    objectFit: 'contain',
  },
  wornBadge: {
    position: 'absolute',
    top: '-2px',
    right: '-2px',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#4a90d9',
    border: '1px solid #fff',
  },
  empty: {
    color: '#666',
    fontSize: '0.8rem',
    fontStyle: 'italic',
  },
};

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [clothes, setClothes] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    function onItemCollected(data) {
      setInventory(data.inventory || []);
    }
    function onInventoryUpdated(data) {
      setInventory(data.inventory || []);
      setClothes(data.clothes || []);
    }

    socket.on('itemCollected', onItemCollected);
    socket.on('inventoryUpdated', onInventoryUpdated);

    return () => {
      socket.off('itemCollected', onItemCollected);
      socket.off('inventoryUpdated', onInventoryUpdated);
    };
  }, []);

  function isWorn(invIndex) {
    // Check if this inventory item is in the clothes array (by reference match via catalogId + index)
    const invItem = inventory[invIndex];
    return clothes.some(c => c === invItem || (c.catalogId === invItem.catalogId && c.wearOffsetX === invItem.wearOffsetX && c.wearOffsetY === invItem.wearOffsetY));
  }

  function toggleItem(invIndex) {
    if (isWorn(invIndex)) {
      // Find the clothes index to unequip
      const invItem = inventory[invIndex];
      const clothesIdx = clothes.findIndex(c => c === invItem || (c.catalogId === invItem.catalogId && c.wearOffsetX === invItem.wearOffsetX && c.wearOffsetY === invItem.wearOffsetY));
      if (clothesIdx >= 0) {
        socket.unequipItem(clothesIdx);
      }
    } else {
      socket.equipItem(invIndex);
    }
  }

  if (inventory.length === 0) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>Items ({inventory.length})</div>
        <button style={styles.toggleButton} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>
      {!collapsed && (
        <div style={styles.grid}>
          {inventory.map((item, i) => {
            const worn = isWorn(i);
            return (
              <div
                key={i}
                style={{
                  ...styles.item,
                  background: worn ? '#3a5a3e' : '#1a1a2e',
                  border: worn ? '2px solid #4a90d9' : '2px solid #444',
                }}
                onClick={() => toggleItem(i)}
                title={`${item.name || item.catalogId}${worn ? ' (worn — click to remove)' : ' (click to wear)'}`}
              >
                <img src={item.image} alt={item.name} style={styles.itemImage} />
                {worn && <div style={styles.wornBadge} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
