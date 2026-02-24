import React, { useEffect, useRef } from 'react';
import ChatInput from './ChatInput';
import { createGame, destroyGame } from '../game/PhaserGame';
import * as socket from '../network/socket';

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
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
      <div ref={gameRef} />
      <ChatInput />
    </div>
  );
}
