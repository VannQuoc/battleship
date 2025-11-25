import React, { useState, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { GameMap } from '../components/map/GameMap';
import { UNIT_DEFINITIONS, TERRAIN } from '../config/constants';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

type Mode = 'SELECT' | 'MOVE' | 'ATTACK' | 'ITEM';

export const BattleScreen = () => {
    const { me, opponent, turn, playerId, moveUnit, fireShot, activateSkill, useItem, mapData, logs } = useGameStore();
    
    const [mode, setMode] = useState<Mode>('SELECT');
    const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    const isMyTurn = turn === playerId;
    const selectedUnit = useMemo(() => me?.fleet.find(u => u.id === selectedUnitId), [me?.fleet, selectedUnitId]);

    const validMoves = useMemo(() => {
        if (mode !== 'MOVE' || !selectedUnit) return [];
        const moves: string[] = [];
        const def = UNIT_DEFINITIONS[selectedUnit.code];
        const range = def?.move || 0; 
        
        for (let x = 0; x < mapData.length; x++) {
            for (let y = 0; y < mapData.length; y++) {
                const dist = Math.abs(x - selectedUnit.x) + Math.abs(y - selectedUnit.y);
                if (dist <= range && dist > 0 && mapData[x][y] !== TERRAIN.ISLAND) {
                     if (mapData[x][y] === TERRAIN.REEF && (def.size >= 4 || def.code === 'SS')) {
                         continue;
                     }
                     moves.push(`${x},${y}`);
                }
            }
        }
        return moves;
    }, [mode, selectedUnit, mapData]);

    const handleMapClick = (x: number, y: number) => {
        if (!isMyTurn) return;

        const clickedUnit = me?.fleet.find(u => u.cells.some(c => c.x === x && c.y === y));
        if (mode === 'SELECT' || mode === 'MOVE' || mode === 'ATTACK') {
            if (clickedUnit) {
                if (clickedUnit.isSunk) return;
                setSelectedUnitId(clickedUnit.id);
                setMode('SELECT'); 
                return;
            }
        }

        if (mode === 'MOVE' && selectedUnitId) {
            if (validMoves.includes(`${x},${y}`)) {
                moveUnit(selectedUnitId, x, y);
                setMode('SELECT');
            } else {
                toast.error("Vị trí không hợp lệ hoặc bị chặn!", { icon: '🚫' });
            }
            return;
        }

        if (mode === 'ATTACK' && selectedUnitId) {
            if(selectedUnit?.code === 'DD' && mapData[x][y] === TERRAIN.ISLAND) {
                toast("Mục tiêu bị che khuất bởi Đảo!", { icon: '⛰️' });
            }
            fireShot(x, y, selectedUnitId);
            setMode('SELECT'); 
            return;
        }
        
        if (mode === 'ITEM' && selectedItem) {
            useItem(selectedItem, { x, y });
            setMode('SELECT');
            setSelectedItem(null);
            toast.success(`Deploying ${selectedItem}...`);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-sea-900 text-white overflow-hidden">
            <header className="h-16 bg-sea-800 border-b border-gray-700 flex items-center justify-between px-6 shadow-lg z-20">
                <div className="flex items-center gap-4">
                    <div className="text-2xl font-mono font-bold text-hologram tracking-widest">CIC CENTER</div>
                    <div className={clsx("px-3 py-1 rounded text-xs font-bold font-mono border", isMyTurn ? "bg-radar/20 border-radar text-radar animate-pulse" : "bg-alert/20 border-alert text-alert")}>
                        {isMyTurn ? 'COMMAND AUTHORIZED' : 'ENEMY SIGNAL DETECTED'}
                    </div>
                </div>
                
                <div className="flex gap-8 font-mono text-xl">
                    <div className="text-radar flex flex-col items-end">
                        <span className="text-[10px] text-gray-400">SUPPLIES</span>
                        {me?.points} PTS
                    </div>
                    <div className="text-alert flex flex-col items-end">
                        <span className="text-[10px] text-gray-400">ADVERSARY</span>
                        {opponent?.name || 'Unknown'}
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 relative flex items-center justify-center bg-sea-950 p-4">
                    <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
                    
                    <GameMap 
                        interactive={isMyTurn} 
                        onCellClick={handleMapClick} 
                        hoverMode={mode === 'ATTACK' ? 'attack' : mode === 'MOVE' ? 'move' : mode === 'ITEM' ? 'item' : null}
                        validMoves={validMoves}
                    />
                    
                    <motion.div 
                        initial={{ y: 100 }} animate={{ y: 0 }}
                        className="absolute bottom-6 bg-sea-800/95 backdrop-blur border border-hologram/30 p-4 rounded-xl flex gap-6 items-center shadow-2xl z-30"
                    >
                        {selectedUnit ? (
                            <>
                                <div className="border-r border-gray-600 pr-6 mr-2">
                                    <div className="text-hologram font-bold text-2xl font-mono">{selectedUnit.code}</div>
                                    <div className="text-xs text-gray-400 font-mono">STATUS: {selectedUnit.hp}/{selectedUnit.maxHp} HP</div>
                                    {selectedUnit.isImmobilized && <div className="text-xs text-alert font-bold animate-pulse">ENGINE FAILURE</div>}
                                </div>
                                
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => setMode('MOVE')} 
                                        disabled={selectedUnit.isImmobilized}
                                        className={clsx("px-6 py-3 rounded font-bold font-mono border transition-all", mode === 'MOVE' ? "bg-hologram text-black border-hologram" : "border-gray-600 hover:border-hologram text-gray-300")}
                                    >
                                        NAVIGATE
                                    </button>
                                    <button 
                                        onClick={() => setMode('ATTACK')} 
                                        className={clsx("px-6 py-3 rounded font-bold font-mono border transition-all", mode === 'ATTACK' ? "bg-alert text-white border-alert" : "border-gray-600 hover:border-alert text-gray-300")}
                                    >
                                        ENGAGE
                                    </button>
                                </div>
                                <button onClick={() => { setSelectedUnitId(null); setMode('SELECT'); }} className="text-xs text-gray-500 hover:text-white absolute top-2 right-2">✕</button>
                            </>
                        ) : (
                            <div className="text-gray-500 text-sm font-mono italic px-4">Awaiting orders... Select a unit on radar.</div>
                        )}
                    </motion.div>
                </div>

                <div className="w-80 bg-sea-800 border-l border-gray-700 flex flex-col z-20">
                     <div className="p-4 border-b border-gray-700 bg-sea-900/50">
                        <h3 className="text-hologram text-xs font-mono mb-2">COMMANDER UPLINK</h3>
                        <button 
                            onClick={activateSkill} 
                            // [FIX] Sử dụng đúng thuộc tính commanderUsed ở cấp root của object me
                            disabled={!isMyTurn || me?.commanderUsed}
                            className="w-full bg-purple-600/20 border border-purple-500 hover:bg-purple-600 hover:text-white text-purple-400 py-3 rounded font-mono font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                            {me?.commanderUsed ? 'SKILL DEPLETED' : 'ACTIVATE SKILL'}
                         </button>
                     </div>

                     <div className="p-4 flex-1 overflow-y-auto">
                        <h3 className="text-hologram text-xs font-mono mb-3">TACTICAL ASSETS</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {me?.inventory.map((item, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => { setSelectedItem(item); setMode('ITEM'); }}
                                    className={clsx(
                                        "p-3 border bg-sea-900/50 text-xs font-mono rounded hover:border-hologram transition-all text-left", 
                                        selectedItem === item ? "border-hologram text-hologram shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]" : "border-gray-700 text-gray-400"
                                    )}
                                >
                                    {item}
                                </button>
                            ))}
                            {me?.inventory.length === 0 && <div className="text-gray-600 text-xs italic col-span-2 text-center py-4">No assets available</div>}
                        </div>
                     </div>

                     <div className="h-1/3 bg-black/40 border-t border-gray-700 p-2 overflow-y-auto font-mono text-[10px]">
                        {logs.slice().reverse().map((log, i) => (
                            <div key={i} className="mb-1 opacity-80 border-b border-white/5 pb-1">
                                <span className="text-hologram">T{log.turn || 0}:</span> {log.unit ? `[${log.unit}]` : ''} {log.action || 'Event'} 
                                <span className={log.result === 'HIT' || log.result === 'SUNK' ? 'text-alert ml-1' : 'text-gray-400 ml-1'}>
                                    {log.result || log.msg}
                                </span>
                            </div>
                        ))}
                     </div>
                </div>
            </div>
        </div>
    );
};