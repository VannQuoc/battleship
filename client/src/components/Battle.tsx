import React from 'react';
import { useGameStore } from '../store/gameStore';
import { GameMap } from './GameMap';
import { Crosshair, Shield, Zap } from 'lucide-react';

export const Battle = () => {
    const { me, opponent, turn, playerId, points, buyItem, activateSkill, useItem } = useGameStore();
    const isMyTurn = turn === playerId;

    return (
        <div className="h-screen bg-sea-900 text-white flex overflow-hidden">
            {/* LEFT: STATUS & ITEMS */}
            <div className="w-80 bg-sea-800 border-r border-gray-700 p-4 flex flex-col">
                <div className="mb-6 p-4 bg-black/40 rounded-lg border border-radar/30">
                    <h2 className="text-2xl font-mono text-radar font-bold">{me.points} PTS</h2>
                    <p className="text-xs text-gray-400">COMMANDER: {me.commander}</p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <h3 className="text-holo font-bold mb-2 flex items-center gap-2"><Zap size={16}/> ABILITIES</h3>
                    <button onClick={activateSkill} 
                            disabled={!isMyTurn}
                            className="w-full p-3 mb-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded font-bold transition">
                        ACTIVATE ULTIMATE
                    </button>

                    <h3 className="text-holo font-bold mb-2 mt-4 flex items-center gap-2"><Shield size={16}/> INVENTORY</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {me.inventory.map((item, idx) => (
                            <button key={idx} 
                                    onClick={() => useItem(item, {})} // Note: Cần UI chọn target cho item (Drone/Nuke)
                                    className="p-2 bg-gray-700 hover:bg-gray-600 text-xs rounded truncate">
                                {item}
                            </button>
                        ))}
                    </div>

                    <h3 className="text-holo font-bold mb-2 mt-6">SHOP</h3>
                    <div className="grid grid-cols-2 gap-2">
                         {['DRONE', 'REPAIR_KIT', 'NUKE'].map(item => (
                             <button key={item} onClick={() => buyItem(item)} className="p-2 border border-gray-600 hover:border-holo text-xs rounded">
                                 Buy {item}
                             </button>
                         ))}
                    </div>
                </div>
            </div>

            {/* CENTER: MAP */}
            <div className="flex-1 flex flex-col items-center justify-center relative bg-grid-pattern">
                {/* HUD Header */}
                <div className="absolute top-4 px-8 py-2 bg-black/60 backdrop-blur border border-white/20 rounded-full flex gap-8 text-xl font-mono">
                    <div className={isMyTurn ? "text-radar animate-pulse" : "text-gray-500"}>
                        {isMyTurn ? "YOUR TURN" : "ENEMY TURN"}
                    </div>
                    <div className="text-alert">VS: {opponent.name}</div>
                </div>

                <div className="scale-75 lg:scale-100 transition-transform">
                    <GameMap />
                </div>
            </div>
            
            {/* RIGHT: LOGS */}
            <div className="w-64 bg-sea-900 border-l border-gray-800 p-4 text-xs font-mono overflow-y-auto">
                 <h3 className="text-gray-400 mb-4 border-b border-gray-700 pb-2">COMBAT LOG</h3>
                 {useGameStore(s => s.logs).slice().reverse().map((log, i) => (
                     <div key={i} className="mb-2 opacity-80">
                         <span className="text-holo">[{log.turn || i}]</span> {JSON.stringify(log.result || log.action || log.msg)}
                     </div>
                 ))}
            </div>
        </div>
    )
}