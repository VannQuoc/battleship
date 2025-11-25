import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { GameMap } from '../components/map/GameMap';

// Config tạm unit definitions để client biết size
const SHIP_DEFINITIONS: Record<string, {size: number, type: string}> = {
    'CV': { size: 5, type: 'SHIP' },
    'BB': { size: 4, type: 'SHIP' },
    'CL': { size: 3, type: 'SHIP' },
    'DD': { size: 2, type: 'SHIP' },
    'SS': { size: 3, type: 'SHIP' },
};

export const SetupScreen = () => {
    const { deployFleet } = useGameStore();
    const [selectedShip, setSelectedShip] = useState<string | null>(null);
    const [vertical, setVertical] = useState(false);
    const [tempFleet, setTempFleet] = useState<any[]>([]);
    
    // Danh sách tàu cần đặt (Hardcode theo luật game)
    const shipsToPlace = ['CV', 'BB', 'CL', 'DD', 'SS']; 

    const handleMapClick = (x: number, y: number) => {
        if (!selectedShip) return;
        
        const shipDef = SHIP_DEFINITIONS[selectedShip];
        
        // Client-side Validation logic (Sơ bộ)
        // Check bounds, collision, terrain (Reef/Island)
        
        setTempFleet([...tempFleet, { code: selectedShip, x, y, vertical }]);
        setSelectedShip(null); // Reset sau khi đặt
    };

    const handleConfirm = () => {
        deployFleet(tempFleet);
    };

    return (
        <div className="flex h-screen bg-sea-900 text-white p-4 gap-4">
            {/* Sidebar Inventory */}
            <div className="w-1/4 bg-sea-800 p-4 rounded border border-hologram/30">
                <h2 className="text-xl font-mono text-hologram mb-4">ARMORY</h2>
                <div className="flex flex-col gap-2">
                    {shipsToPlace.map(code => (
                        <button 
                            key={code}
                            disabled={tempFleet.some(s => s.code === code)}
                            onClick={() => setSelectedShip(code)}
                            className={`p-3 text-left border ${selectedShip === code ? 'bg-radar/20 border-radar' : 'border-gray-600'} hover:bg-sea-700 transition-all`}
                        >
                            <span className="font-bold">{code}</span>
                            <span className="text-xs ml-2 text-gray-400">Size: {SHIP_DEFINITIONS[code].size}</span>
                        </button>
                    ))}
                </div>
                
                <div className="mt-8">
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={vertical} onChange={e => setVertical(e.target.checked)} />
                        <span>Vertical Mode (Rotate)</span>
                     </label>
                </div>

                <button 
                    onClick={handleConfirm}
                    className="w-full mt-auto bg-hologram text-black font-bold py-3 mt-4 hover:bg-cyan-400"
                >
                    CONFIRM DEPLOYMENT
                </button>
            </div>

            {/* Main Map */}
            <div className="flex-1 flex items-center justify-center bg-sea-950 rounded border border-hologram/20">
                <div className="scale-90 origin-center">
                    <GameMap interactive={true} onCellClick={handleMapClick} />
                </div>
            </div>
        </div>
    );
};