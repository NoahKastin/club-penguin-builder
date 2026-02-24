import React, { useState } from 'react';
import NameEntry from './components/NameEntry';
import GameView from './components/GameView';

export default function App() {
  const [penguinName, setPenguinName] = useState(null);

  if (!penguinName) {
    return <NameEntry onJoin={setPenguinName} />;
  }

  return <GameView penguinName={penguinName} />;
}
