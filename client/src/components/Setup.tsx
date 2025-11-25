import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { GameMap } from './GameMap';

// Hardcode danh sách tàu mặc định để deploy (theo config definitions.js)
const DEFAULT_FLEET = [
    { code: 'CV', size: 5 },
    { code: 'BB', size: 4 },
    { code: 'CL', size: 3 },
    { code: 'DD', size: 2 },
    { code: 'DD', size: 2 },
    { code: 'SS', size: 3 },
    { code: 'SILO', size: 3 }, // Structure ví dụ
];

export const Setup = () => {
    const { deployFleet } = useGameStore();
    const [fleet, setFleet] = useState<any[]>([]); // Tàu đã đặt
    const [available, setAvailable] = useState(DEFAULT_FLEET); // Tàu chưa đặt
    
    // Logic đặt tàu tạm thời trên client:
    // User click vào tàu trong list -> Chọn tọa độ trên map (GameMap cần mode SETUP)
    // Để đơn giản cho code demo: Ta dùng Form nhập tọa độ hoặc nút Auto-Deploy Random.
    
    // AUTO DEPLOY FUNCTION (Để tiết kiệm thời gian UI Drag-Drop phức tạp)
    const handleAutoDeploy = () => {
        // Logic random đơn giản (Cần check va chạm thực tế, ở đây làm dummy để gửi lên server check)
        // Client này chỉ gửi request, Server GameRoom.deployFleet sẽ validate.
        // Đây là ví dụ set cứng để test:
        const deployData = [
            { code: 'CV', x: 0, y: 0, vertical: true },
            { code: 'BB', x: 2, y: 0, vertical: false },
            { code: 'CL', x: 2, y: 2, vertical: true },
            { code: 'DD', x: 4, y: 5, vertical: false },
            { code: 'DD', x: 6, y: 5, vertical: false },
            { code: 'SS', x: 8, y: 8, vertical: true },
            { code: 'SILO', x: 10, y: 10, vertical: false }
        ];
        deployFleet(deployData);
    };

    return (
        <div className="h-screen bg-sea-900 text-white flex flex-col items-center justify-center">
            <h2 className="text-2xl font-mono text-holo mb-4">DEPLOYMENT PHASE</h2>
            <div className="flex gap-8">
                <div className="w-64 bg-sea-800 p-4 rounded">
                    <h3 className="text-lg font-bold mb-4">ARMORY</h3>
                    {available.map((ship, idx) => (
                        <div key={idx} className="mb-2 p-2 bg-black/30 border border-gray-600 rounded flex justify-between">
                            <span>{ship.code}</span>
                            <span className="text-xs bg-gray-700 px-2 rounded">Size: {ship.size}</span>
                        </div>
                    ))}
                    <button onClick={handleAutoDeploy} className="mt-8 w-full py-3 bg-holo text-black font-bold rounded hover:bg-white">
                        AUTO DEPLOY (TEST)
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">*Click to send deploy request to server</p>
                </div>
                
                {/* Map Preview */}
                <div className="opacity-50 pointer-events-none grayscale">
                    <GameMap />
                </div>
            </div>
        </div>
    )
}