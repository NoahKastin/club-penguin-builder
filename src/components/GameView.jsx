import React, { useEffect, useRef } from 'react';
import ChatLog from './ChatLog';
import ChatInput from './ChatInput';
import PlayerList from './PlayerList';
import Inventory from './Inventory';
import { createGame, destroyGame } from '../game/PhaserGame';
import * as socket from '../network/socket';

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '800px',
    height: '100%',
  },
  header: {
    padding: '4px 8px',
    flexShrink: 0,
  },
  backButton: {
    padding: '6px 14px',
    fontSize: '0.9rem',
    borderRadius: '6px',
    border: 'none',
    background: '#555',
    color: '#eee',
    cursor: 'pointer',
  },
  gameContainer: {
    position: 'relative',
    width: '100%',
    height: 'calc(100% - 230px)',
    minHeight: '100px',
  },
};

export default function GameView({ penguinName, authToken, cpId, onBack }) {
  const gameRef = useRef(null);

  useEffect(() => {
    const game = createGame(gameRef.current);
    socket.joinWhenReady(penguinName, cpId, authToken);

    return () => {
      socket.reset();
      destroyGame(game);
    };
  }, [penguinName, cpId]);

  function handleBack() {
    socket.reset();
    onBack();
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={handleBack}>Back to Menu</button>
      </div>
      <div ref={gameRef} style={styles.gameContainer} />
      <Inventory />
      <PlayerList />
      <ChatLog />
      <ChatInput />
    </div>
  );
}
