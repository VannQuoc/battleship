import React from 'react';
import { Toaster } from 'react-hot-toast';
import { useGameStore } from './store/useGameStore';
import { LobbyScreen } from './screens/LobbyScreen';
import { SetupScreen } from './screens/SetupScreen';
import { BattleScreen } from './screens/BattleScreen';

function App() {
  const status = useGameStore((state) => state.status);

  return (
    <div className="font-sans antialiased text-white bg-sea-900 min-h-screen">
      <Toaster 
        position="top-right" 
        toastOptions={{
            style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' },
            success: { style: { border: '1px solid #10b981' } },
            error: { style: { border: '1px solid #ef4444' } }
        }}
      />
      
      {status === 'LOBBY' && <LobbyScreen />}
      {status === 'SETUP' && <SetupScreen />}
      {status === 'BATTLE' && <BattleScreen />}
      {status === 'ENDED' && (
          <div className="h-screen flex flex-col items-center justify-center bg-black/90 z-50 fixed inset-0">
             <h1 className="text-6xl font-bold text-hologram mb-4">MISSION ACCOMPLISHED</h1>
             <button onClick={() => window.location.reload()} className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200">
                RETURN TO BASE
             </button>
          </div>
      )}
    </div>
  );
}

export default App;