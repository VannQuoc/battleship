import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useGameStore } from '@/store/useGameStore';
import { SetupScreen } from '@/screens/SetupScreen';
import { BattleScreen } from '@/screens/BattleScreen';

// Simple Login Screen Component
const LoginScreen = () => {
    const { connect, joinRoom, createRoom } = useGameStore();
    const [name, setName] = React.useState('');
    const [room, setRoom] = React.useState('');

    const handleConnect = () => {
        connect('http://localhost:3000'); // URL Server
    };

    return (
        <div className="h-screen bg-sea-900 flex flex-col items-center justify-center gap-4 text-white">
            <h1 className="text-4xl font-mono text-hologram tracking-widest">NAVAL WARFARE</h1>
            <input className="p-2 bg-sea-800 border border-hologram" placeholder="Nickname" onChange={e => setName(e.target.value)} />
            <input className="p-2 bg-sea-800 border border-hologram" placeholder="Room ID" onChange={e => setRoom(e.target.value)} />
            <div className="flex gap-4">
                <button onClick={() => { handleConnect(); setTimeout(() => createRoom(name, room), 500)}} className="bg-radar text-black px-6 py-2 font-bold hover:bg-green-400">CREATE</button>
                <button onClick={() => { handleConnect(); setTimeout(() => joinRoom(name, room), 500)}} className="bg-hologram text-black px-6 py-2 font-bold hover:bg-cyan-400">JOIN</button>
            </div>
        </div>
    );
};

function App() {
  const status = useGameStore((state) => state.status);

  return (
    <div className="font-sans antialiased">
      <Toaster position="top-right" toastOptions={{
          style: { background: '#1e293b', color: '#fff', border: '1px solid #06b6d4' }
      }}/>
      
      {status === 'LOBBY' && <LoginScreen />} 
      {/* Note: Thực tế LOBBY và LOGIN nên tách ra, ở đây gộp để demo flow nhanh */}
      
      {status === 'SETUP' && <SetupScreen />}
      
      {status === 'BATTLE' && <BattleScreen />}
      
      {status === 'ENDED' && (
          <div className="h-screen flex items-center justify-center bg-black text-alert text-4xl font-bold">
              GAME OVER
          </div>
      )}
    </div>
  );
}

export default App;