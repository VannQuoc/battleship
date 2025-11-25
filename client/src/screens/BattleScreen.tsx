import React, { useState, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { GameMap } from '../components/map/GameMap';
import { UNIT_DEFINITIONS, TERRAIN } from '../config/constants';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

// Định nghĩa đúng Type
type InteractionMode = 'SELECT' | 'MOVE' | 'ATTACK' | 'ITEM';

export const BattleScreen = () => {
    const { me, opponent, turn, playerId, moveUnit, fireShot, activateSkill, useItem, mapData } = useGameStore();
    
    // Khởi tạo State chuẩn
    const [mode, setMode] = useState<InteractionMode>('SELECT');
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const isMyTurn = turn === playerId;

    // Helper: Lấy Unit đang chọn
    const selectedUnit = useMemo(() => me?.fleet.find(u => u.id === selectedUnitId), [me?.fleet, selectedUnitId]);

    // Calculate Valid Moves
    const validMoves = useMemo(() => {
        if (mode !== 'MOVE' || !selectedUnit) return [];
        const moves: string[] = [];
        const range = selectedUnit.definition?.move || 0; 
        
        for (let x = 0; x < mapData.length; x++) {
            for (let y = 0; y < mapData.length; y++) {
                const dist = Math.abs(x - selectedUnit.x) + Math.abs(y - selectedUnit.y);
                if (dist <= range && dist > 0) {
                     if (mapData[x][y] !== TERRAIN.ISLAND) {
                         const def = UNIT_DEFINITIONS[selectedUnit.code];
                         if (mapData[x][y] === TERRAIN.REEF && (def.size >= 4 || def.code === 'SS')) {
                             continue;
                         }
                         moves.push(`${x},${y}`);
                     }
                }
            }
        }
        return moves;
    }, [mode, selectedUnit, mapData]);

    const handleMapClick = (x: number, y: number) => {
        if (!isMyTurn) return;

        // 1. SELECT UNIT
        const clickedUnit = me?.fleet.find(u => u.cells.some(c => c.x === x && c.y === y));
        if (clickedUnit && mode === 'SELECT') {
            if (!clickedUnit.isSunk && !clickedUnit.isImmobilized) {
                setSelectedUnitId(clickedUnit.id);
            }
            return;
        }

        // 2. MOVE
        if (mode === 'MOVE' && selectedUnitId) {
            if (validMoves.includes(`${x},${y}`)) {
                moveUnit(selectedUnitId, x, y);
                setMode('SELECT');
                setSelectedUnitId(null);
            } else {
                toast.error("Invalid Move!");
            }
            return;
        }

        // 3. ATTACK
        if (mode === 'ATTACK') {
            if(selectedUnit?.definition?.trajectory === 'DIRECT' && mapData[x][y] === TERRAIN.ISLAND) {
                toast("Line of Sight Blocked!", { icon: '🚫' });
                return;
            }
            
            fireShot(x, y, selectedUnitId || undefined);
            setMode('SELECT'); 
            return;
        }
        
        // 4. ITEM
        if (mode === 'ITEM' && selectedItem) {
            useItem(selectedItem, { x, y });
            setMode('SELECT');
            setSelectedItem(null);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-sea-900 text-white">
            {/* HUD */}
            <header className="h-16 bg-sea-800 border-b border-gray-700 flex items-center justify-between px-6 shadow-lg z-20">
                <div className="flex items-center gap-4">
                    <div className="text-2xl font-mono font-bold text-hologram">CIC CENTER</div>
                    <div className={`px-3 py-1 rounded text-xs font-bold ${isMyTurn ? 'bg-radar text-black animate-pulse' : 'bg-red-900 text-red-200'}`}>
                        {isMyTurn ? 'COMMAND AUTHORIZED' : 'ENEMY TURN'}
                    </div>
                </div>
                
                <div className="flex gap-8 font-mono text-xl">
                    <div className="text-radar">PTS: {me?.points}</div>
                    <div className="text-alert">FOE: {opponent?.name || 'Unknown'}</div>
                </div>
            </header>

            {/* Main Battle View */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 relative flex items-center justify-center bg-black/20">
                    <GameMap 
                        interactive={isMyTurn} 
                        onCellClick={handleMapClick} 
                        hoverMode={mode === 'ATTACK' ? 'attack' : mode === 'MOVE' ? 'move' : null}
                        validMoves={validMoves}
                    />
                    
                    {/* Control Panel */}
                    <div className="absolute bottom-6 bg-sea-800/90 backdrop-blur border border-hologram/30 p-4 rounded-xl flex gap-4 items-center shadow-2xl">
                        {selectedUnit ? (
                            <>
                                <div className="border-r border-gray-600 pr-4 mr-2">
                                    <div className="text-radar font-bold text-lg">{selectedUnit.code}</div>
                                    <div className="text-xs text-gray-400">HP: {selectedUnit.hp}/{selectedUnit.maxHp}</div>
                                </div>
                                <button 
                                    onClick={() => setMode('MOVE')} 
                                    disabled={selectedUnit.isImmobilized}
                                    className={clsx("btn-action px-4 py-2 rounded font-bold border border-gray-600 hover:border-hologram", mode === 'MOVE' && "bg-hologram text-black")}
                                >
                                    MOVE
                                </button>
                                <button 
                                    onClick={() => setMode('ATTACK')} 
                                    className={clsx("btn-action px-4 py-2 rounded font-bold border border-gray-600 hover:border-alert", mode === 'ATTACK' && "bg-alert text-white")}
                                >
                                    FIRE
                                </button>
                                <button onClick={() => { setSelectedUnitId(null); setMode('SELECT'); }} className="text-xs text-gray-400 hover:text-white">CANCEL</button>
                            </>
                        ) : (
                            <div className="text-gray-400 text-sm italic">Select a unit to issue commands</div>
                        )}
                    </div>
                    
                    {/* Skills & Items */}
                    <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                         <button 
                            onClick={activateSkill} 
                            disabled={!isMyTurn}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded font-bold border border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                         >
                            COMMANDER SKILL
                         </button>
                         
                         <div className="flex gap-2">
                            {me?.inventory.map((item, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => { setSelectedItem(item); setMode('ITEM'); }}
                                    className={clsx("p-2 border bg-black/50 text-xs rounded hover:border-hologram", selectedItem === item ? "border-hologram text-hologram" : "border-gray-600 text-gray-400")}
                                >
                                    {item}
                                </button>
                            ))}
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
};