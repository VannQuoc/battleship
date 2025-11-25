import React, { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { Toaster } from 'react-hot-toast';
import { Lobby } from './components/Lobby';
import { Setup } from './components/Setup';
import { Battle } from './components/Battle';

function App() {
  const { connect, status, winner } = useGameStore();

  useEffect(() => {
    connect();
  }, []);

  if (status === 'ENDED') {
      return (
          <div className="h-screen flex flex-col items-center justify-center bg-black text-white">
              <h1 className="text-6xl font-bold text-alert mb-4">GAME OVER</h1>
              <h2 className="text-3xl">WINNER: {winner}</h2>
              <button onClick={() => window.location.reload()} className="mt-8 px-6 py-2 bg-white text-black">PLAY AGAIN</button>
          </div>
      )
  }

  return (
    <>
      <Toaster position="top-right" toastOptions={{
          style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' }
      }}/>
      
      {status === 'LOBBY' && <Lobby />}
      {status === 'SETUP' && <Setup />}
      {status === 'BATTLE' && <Battle />}
    </>
  );
}

export default App;