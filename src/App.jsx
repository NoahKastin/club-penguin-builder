import React, { useState } from 'react';
import NameEntry from './components/NameEntry';
import MainMenu from './components/MainMenu';
import GameView from './components/GameView';

export default function App() {
  const [penguinName, setPenguinName] = useState(null);
  const [selectedCP, setSelectedCP] = useState(null);

  if (!penguinName) {
    return <NameEntry onJoin={setPenguinName} />;
  }

  if (!selectedCP) {
    return <MainMenu penguinName={penguinName} onSelectCP={setSelectedCP} />;
  }

  return (
    <GameView
      penguinName={penguinName}
      cpId={selectedCP.id}
      onBack={() => setSelectedCP(null)}
    />
  );
}
