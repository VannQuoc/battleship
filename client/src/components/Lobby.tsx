import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Ship, Eye, Hammer } from 'lucide-react';

const COMMANDERS = [
    { id: 'ADMIRAL', name: 'Đô Đốc', icon: <Ship size={40}/>, desc: 'Passive: Tàu trâu hơn (+20% HP). Active: Tăng tầm nhìn.' },
    { id: 'SPY', name: 'Điệp Viên', icon: <Eye size={40}/>, desc: 'Passive: Submarine đi xa hơn. Active: Hack Map 3s.' },
    { id: 'ENGINEER', name: 'Kỹ Sư', icon: <Hammer size={40}/>, desc: 'Passive: Giảm giá xây dựng. Active: Hồi đầy máu 1 tàu.' },
];

export const Lobby = () => {
    const { createRoom, joinRoom, selectCommander, playerId, roomId, me, status, opponent } = useGameStore();
    const [name, setName] = useState('');
    const [inputRoom, setInputRoom] = useState('');

    if (!roomId) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-sea-900 text-holo font-mono gap-4">
                <h1 className="text-6xl font-black tracking-tighter uppercase mb-8">Battleship <span className="text-alert">WARFARE</span></h1>
                <input className="bg-sea-800 border border-holo p-3 w-64 text-center outline-none focus:ring-2 ring-holo" 
                       placeholder="CODENAME (Name)" value={name} onChange={e => setName(e.target.value)} />
                <input className="bg-sea-800 border border-holo p-3 w-64 text-center outline-none" 
                       placeholder="ROOM ID" value={inputRoom} onChange={e => setInputRoom(e.target.value)} />
                
                <div className="flex gap-4">
                    <button onClick={() => createRoom(name, inputRoom)} className="px-6 py-3 bg-holo text-black font-bold hover:bg-white transition">CREATE OPS</button>
                    <button onClick={() => joinRoom(name, inputRoom)} className="px-6 py-3 border border-holo hover:bg-holo/20 transition">JOIN OPS</button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen bg-sea-900 text-white p-8 flex flex-col items-center">
             <h2 className="text-3xl font-mono text-holo mb-8">TACTICAL BRIEFING ROOM: {roomId}</h2>
             
             <div className="flex gap-12 w-full max-w-4xl">
                {/* Player Status */}
                <div className="flex-1 bg-sea-800 p-6 rounded border border-white/10">
                    <h3 className="text-xl text-radar mb-4">PLAYERS</h3>
                    <div className="p-2 bg-sea-900 mb-2 flex justify-between">
                        <span>{name} (YOU)</span>
                        <span className="text-holo">{me.commander || 'Select Commander...'}</span>
                    </div>
                    <div className="p-2 bg-sea-900 flex justify-between">
                        <span>{opponent.name}</span>
                        <span className="text-alert">{status === 'BATTLE' ? 'READY' : '...'}</span>
                    </div>
                </div>

                {/* Commander Select */}
                <div className="flex-[2] grid grid-cols-3 gap-4">
                    {COMMANDERS.map(cmd => (
                        <div key={cmd.id} 
                             onClick={() => selectCommander(cmd.id)}
                             className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:-translate-y-2 
                                ${me.commander === cmd.id ? 'border-radar bg-radar/10 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'border-gray-600 bg-sea-800 opacity-60 hover:opacity-100'}`}>
                            <div className="flex justify-center mb-4 text-holo">{cmd.icon}</div>
                            <h4 className="font-bold text-center text-lg">{cmd.name}</h4>
                            <p className="text-xs text-gray-400 mt-2 text-center">{cmd.desc}</p>
                        </div>
                    ))}
                </div>
             </div>
             
             {/* Note: Chuyển sang Setup phase sẽ được trigger bởi user click nút (nếu backend hỗ trợ) hoặc tự động khi chọn xong */}
             <div className="mt-8 text-sm text-gray-500 animate-pulse">Waiting for Setup Phase...</div>
        </div>
    )
}