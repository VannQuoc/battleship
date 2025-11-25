import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { GameMap } from '../components/map/GameMap';
import { UNIT_DEFINITIONS, TERRAIN } from '../config/constants';
import toast from 'react-hot-toast';

export const SetupScreen = () => {
    const { deployFleet, mapData, me } = useGameStore();
    const [selectedShipCode, setSelectedShipCode] = useState<string | null>(null);
    const [vertical, setVertical] = useState(false);
    const [placedShips, setPlacedShips] = useState<any[]>([]);

    // Ships to place (Hardcoded based on rule)
    const availableShips = ['CV', 'BB', 'CL', 'DD', 'SS'];

    const handleMapClick = (x: number, y: number) => {
        if (!selectedShipCode) return;

        const def = UNIT_DEFINITIONS[selectedShipCode];
        if (!def) return;

        // 1. Check Bounds
        const size = def.size;
        const endX = vertical ? x : x + size - 1;
        const endY = vertical ? y + size - 1 : y;

        if (endX >= mapData.length || endY >= mapData.length) {
            toast.error("Out of bounds!");
            return;
        }

        // 2. Check Collision (Map & Ships)
        for (let i = 0; i < size; i++) {
            const cx = vertical ? x : x + i;
            const cy = vertical ? y + i : y;
            
            // Terrain Check
            const cellTerrain = mapData[cx][cy];
            if (cellTerrain === TERRAIN.ISLAND) {
                toast.error("Cannot place on Island!");
                return;
            }
            if (cellTerrain === TERRAIN.REEF) {
                 toast.error("Cannot place on Reef!");
                 return;
            }

            // Overlap Check
            const overlap = placedShips.some(s => {
                const sDef = UNIT_DEFINITIONS[s.code];
                for(let j=0; j<sDef.size; j++){
                    const sx = s.vertical ? s.x : s.x + j;
                    const sy = s.vertical ? s.y + j : s.y;
                    if(sx === cx && sy === cy) return true;
                }
                return false;
            });

            if (overlap) {
                toast.error("Overlap with another ship!");
                return;
            }
        }

        // 3. Place
        setPlacedShips([...placedShips, { code: selectedShipCode, x, y, vertical }]);
        setSelectedShipCode(null);
    };

    const handleConfirm = () => {
        if (placedShips.length < availableShips.length) {
            toast.error("Deploy all ships first!");
            return;
        }
        deployFleet(placedShips);
    };

    const handleReset = () => {
        setPlacedShips([]);
    };

    // Filter ships not yet placed
    const remainingShips = availableShips.filter(code => 
        !placedShips.some(s => s.code === code)
    );

    return (
        <div className="flex h-screen bg-sea-900 text-white overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 bg-sea-800 border-r border-gray-700 flex flex-col p-4">
                <h2 className="text-xl font-mono text-hologram mb-6">FLEET DEPLOYMENT</h2>
                
                <div className="flex-1 overflow-y-auto space-y-2">
                    {remainingShips.map(code => (
                        <button 
                            key={code}
                            onClick={() => setSelectedShipCode(code)}
                            className={`w-full p-4 border rounded text-left transition-all ${
                                selectedShipCode === code ? 'bg-radar text-black border-radar' : 'border-gray-600 hover:bg-sea-700'
                            }`}
                        >
                            <div className="font-bold">{UNIT_DEFINITIONS[code].name}</div>
                            <div className="text-xs opacity-70">Size: {UNIT_DEFINITIONS[code].size} cells</div>
                        </button>
                    ))}
                    {remainingShips.length === 0 && (
                        <div className="text-radar text-center py-4 border border-dashed border-radar rounded bg-radar/10">
                            ALL UNITS READY
                        </div>
                    )}
                </div>

                <div className="mt-4 space-y-3">
                    <label className="flex items-center gap-3 p-3 bg-black/30 rounded cursor-pointer border border-gray-600 hover:border-hologram">
                        <input type="checkbox" className="w-5 h-5 accent-hologram" checked={vertical} onChange={e => setVertical(e.target.checked)} />
                        <span className="font-mono text-sm">ROTATE VERTICAL (R)</span>
                    </label>

                    <div className="flex gap-2">
                        <button onClick={handleReset} className="flex-1 py-2 border border-red-500 text-red-500 font-bold hover:bg-red-500 hover:text-white rounded">RESET</button>
                        <button onClick={handleConfirm} className="flex-1 py-2 bg-hologram text-black font-bold hover:bg-cyan-400 rounded">CONFIRM</button>
                    </div>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 bg-sea-950 flex items-center justify-center relative">
                 <div className="absolute top-4 left-4 text-gray-500 font-mono text-xs">
                    Coordinates: 00-00<br/>
                    Terrain: WATER
                 </div>
                 
                 {/* Temporary local override for me.fleet to show placed ships */}
                 {/* Note: In real app, we should pass placedShips to GameMap to render phantom ships */}
                 <div className="scale-90">
                     <GameMap interactive={true} onCellClick={handleMapClick} />
                 </div>
            </div>
        </div>
    );
};