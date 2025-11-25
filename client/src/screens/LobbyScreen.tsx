import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { COMMANDERS } from '../config/constants';
import { clsx } from 'clsx';

export const LobbyScreen = () => {
    const { createRoom, joinRoom, selectCommander, connect, me, roomId } = useGameStore();
    const [name, setName] = useState('');
    const [roomInput, setRoomInput] = useState('');
    const [selectedCmd, setSelectedCmd] = useState<string | null>(null);

    // Initial Connect
    React.useEffect(() => {
        connect('http://localhost:3000');
    }, []);

    const handleJoin = (mode: 'create' | 'join') => {
        if(!name || !roomInput) return;
        if(mode === 'create') createRoom(name, roomInput);
        else joinRoom(name, roomInput);
    };

    if (!roomId) {
        return (
            <div className="h-screen bg-sea-900 flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                <div className="z-10 bg-sea-800 p-8 rounded-xl border border-hologram/50 shadow-2xl flex flex-col gap-4 w-96">
                    <h1 className="text-3xl font-mono text-hologram text-center font-bold tracking-widest">WAR ROOM</h1>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-mono">OPERATOR NAME</label>
                        <input className="bg-black/50 border border-gray-600 p-2 text-radar font-mono focus:border-hologram outline-none" 
                            value={name} onChange={e => setName(e.target.value)} placeholder="Enter codename" />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 font-mono">SECURE FREQUENCY (ROOM ID)</label>
                        <input className="bg-black/50 border border-gray-600 p-2 text-white font-mono focus:border-hologram outline-none" 
                            value={roomInput} onChange={e => setRoomInput(e.target.value)} placeholder="Room-001" />
                    </div>

                    <div className="flex gap-4 mt-4">
                        <button onClick={() => handleJoin('create')} className="flex-1 bg-radar text-black font-bold py-2 hover:bg-emerald-400 transition-colors">INITIATE</button>
                        <button onClick={() => handleJoin('join')} className="flex-1 border border-hologram text-hologram font-bold py-2 hover:bg-hologram hover:text-black transition-colors">CONNECT</button>
                    </div>
                </div>
            </div>
        );
    }

    // Lobby UI
    return (
        <div className="h-screen bg-sea-900 text-white p-8">
            <header className="mb-8 border-b border-gray-700 pb-4 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-mono text-hologram">BRIEFING ROOM: {roomId}</h2>
                    <p className="text-gray-400">Waiting for deployment...</p>
                </div>
                <div className="text-right">
                    <p>Status: {me ? 'CONNECTED' : 'CONNECTING...'}</p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {COMMANDERS.map(cmd => (
                    <div 
                        key={cmd.id}
                        onClick={() => { setSelectedCmd(cmd.id); selectCommander(cmd.id); }}
                        className={clsx(
                            "cursor-pointer border-2 rounded-xl p-6 transition-all hover:scale-105",
                            selectedCmd === cmd.id 
                                ? "border-hologram bg-sea-800 shadow-[0_0_20px_rgba(6,182,212,0.3)]" 
                                : "border-gray-700 bg-sea-950 hover:border-gray-500"
                        )}
                    >
                        <div className="h-40 bg-gray-900 mb-4 rounded flex items-center justify-center text-4xl">
                            {cmd.id === 'ADMIRAL' ? '⭐⭐⭐' : cmd.id === 'SPY' ? '🕵️' : '🔧'}
                        </div>
                        <h3 className="text-xl font-bold text-radar mb-2">{cmd.name}</h3>
                        <p className="text-sm text-gray-400 mb-4">{cmd.desc}</p>
                        <div className="bg-black/30 p-2 rounded text-xs text-hologram font-mono border border-hologram/20">
                            ULTIMATE: {cmd.skill}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};