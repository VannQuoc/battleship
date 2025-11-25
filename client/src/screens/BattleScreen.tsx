import React from 'react';
import { useGameStore } from '../store/useGameStore';
import { GameMap } from '../components/map/GameMap';

export const BattleScreen = () => {
    // Thêm 'playerId' vào danh sách lấy từ store
    const { turn, me, fireShot, status, logs, playerId } = useGameStore();

    // So sánh trực tiếp turn hiện tại với playerId của mình
    const isMyTurn = turn === playerId;
    const handleAttack = (x: number, y: number) => {
        if (!isMyTurn) return;
        // Logic chọn Preferred Unit có thể thêm ở đây (Click tàu mình trước -> Click địch)
        fireShot(x, y); 
    };

    return (
        <div className="flex flex-col h-screen bg-sea-900 text-white">
            {/* HUD */}
            <header className="h-16 border-b border-hologram/30 flex items-center justify-between px-6 bg-sea-800/80 backdrop-blur">
                <div className="text-2xl font-mono font-bold text-hologram">BATTLE_STATION</div>
                <div className={`px-4 py-1 rounded ${isMyTurn ? 'bg-radar text-black' : 'bg-alert text-white'}`}>
                    {isMyTurn ? 'YOUR TURN' : 'ENEMY TURN'}
                </div>
                <div>Points: {me?.points || 0}</div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Battle Map */}
                <div className="flex-1 flex items-center justify-center p-8">
                     {/* Lưu ý: Trong thực tế sẽ cần 2 map (Map mình và Map Radar dò địch).
                        Hiện tại GameMap đang render chung dựa trên logic `getUnitAt`.
                        Ở bản hoàn thiện cần tách: <MyMap /> và <RadarMap />
                     */}
                    <GameMap interactive={isMyTurn} onCellClick={handleAttack} />
                </div>

                {/* Logs / Action Panel */}
                <div className="w-80 border-l border-hologram/30 bg-sea-950 p-4 font-mono text-sm overflow-y-auto">
                    <h3 className="text-hologram mb-2 border-b border-gray-700 pb-1">COMBAT LOGS</h3>
                    <div className="flex flex-col gap-1">
                        {logs.slice().reverse().map((log, i) => (
                            <div key={i} className="text-gray-400">
                                <span className="text-cyan-600">[{log.turn}]</span> {JSON.stringify(log.result || log.action)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Action Bar (Skills/Items) */}
            <div className="h-20 border-t border-hologram/30 bg-sea-800 flex items-center justify-center gap-4">
                {me?.inventory.map((item, idx) => (
                    <button key={idx} className="p-2 border border-gray-600 hover:border-hologram rounded bg-black/40 text-xs">
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );
};