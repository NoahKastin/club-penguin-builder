import React, { useEffect, useRef } from 'react';
import ChatLog from './ChatLog';
import ChatInput from './ChatInput';
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
  gameContainer: {
    position: 'relative',
    width: '100%',
    height: 'calc(100% - 200px)',
    minHeight: '100px',
  },
};

export default function GameView({ penguinName }) {
  const gameRef = useRef(null);

  useEffect(() => {
    const game = createGame(gameRef.current);
    socket.joinWhenReady(penguinName);

    return () => {
      socket.reset();
      destroyGame(game);
    };
  }, [penguinName]);

  return (
    <div style={styles.wrapper}>
      <div ref={gameRef} style={styles.gameContainer} />
      <ChatLog />
      <ChatInput />
    </div>
  );
}
