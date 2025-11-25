import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { TERRAIN } from '../../config/constants';
import { UnitRenderer } from './UnitRenderer';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
// [FIX]: Import Unit type
import { Unit } from '../../types';

interface MapProps {
    interactive?: boolean;
    onCellClick?: (x: number, y: number) => void;
    hoverMode?: 'move' | 'attack' | 'deploy' | null;
    validMoves?: string[]; // List key "x,y"
}

export const GameMap = ({ interactive, onCellClick, hoverMode, validMoves }: MapProps) => {
  const { mapData, me, opponent, lastEffect } = useGameStore();

  if (!mapData || mapData.length === 0) return <div className="text-hologram animate-pulse">Scan Radar...</div>;

  const renderShotEffect = () => {
      if(lastEffect?.type === 'SHOT' && lastEffect.attackerId !== undefined) {
          return (
            <motion.div
                initial={{ opacity: 1, scale: 2 }}
                animate={{ opacity: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute w-full h-full bg-yellow-400 z-50 rounded-full"
                style={{ 
                    gridColumn: lastEffect.y + 1, 
                    gridRow: lastEffect.x + 1 
                }}
            />
          );
      }
      return null;
  };

  return (
    <div className="relative inline-block bg-sea-950 p-1 border border-hologram shadow-[0_0_20px_rgba(6,182,212,0.2)] rounded">
        <div 
            className="grid gap-[1px]"
            style={{ 
                gridTemplateColumns: `repeat(${mapData.length}, 40px)`,
                gridTemplateRows: `repeat(${mapData.length}, 40px)`
            }}
        >
            {mapData.map((row, x) => (
                row.map((terrain, y) => {
                    const cellKey = `${x},${y}`;
                    const isValidMove = validMoves?.includes(cellKey);
                    
                    let bgClass = 'bg-sea-900/40';
                    if (terrain === TERRAIN.ISLAND) bgClass = 'bg-neutral-700 border-neutral-600 shadow-inner';
                    if (terrain === TERRAIN.REEF) bgClass = 'bg-cyan-900/60 border-cyan-800 border-dashed';

                    return (
                        <div 
                            key={cellKey}
                            onClick={() => interactive && onCellClick && onCellClick(x, y)}
                            className={clsx(
                                "relative w-10 h-10 border border-white/5 transition-colors cursor-crosshair",
                                bgClass,
                                interactive && "hover:border-hologram",
                                isValidMove && "bg-radar/30 animate-pulse",
                                hoverMode === 'attack' && interactive && "hover:bg-alert/40"
                            )}
                        >
                            {terrain === TERRAIN.ISLAND && <span className="absolute top-0 right-0 text-[8px] text-gray-400">⛰️</span>}
                            {terrain === TERRAIN.REEF && <span className="absolute bottom-0 left-0 text-[8px] text-cyan-500">ww</span>}

                            {me?.fleet.map(u => {
                                if (u.x === x && u.y === y) {
                                    return (
                                        <div key={u.id} className="absolute top-0 left-0 z-10"
                                            style={{ 
                                                width: u.vertical ? '100%' : `${u.cells.length * 100}%`,
                                                height: u.vertical ? `${u.cells.length * 100}%` : '100%'
                                            }}
                                        >
                                            <UnitRenderer unit={u} />
                                        </div>
                                    )
                                }
                                return null;
                            })}

                            {opponent?.fleet.map(u => {
                                if (u.x === x && u.y === y) {
                                     return (
                                        <div key={u.id} className="absolute top-0 left-0 z-10"
                                            style={{ 
                                                width: u.vertical ? '100%' : `${(u.cells?.length || 1) * 100}%`,
                                                height: u.vertical ? `${(u.cells?.length || 1) * 100}%` : '100%'
                                            }}
                                        >
                                            {/* Cast 'u' as Unit to fix Type Error */}
                                            <UnitRenderer unit={u as Unit} isEnemy />
                                        </div>
                                    )
                                }
                                return null;
                            })}
                        </div>
                    );
                })
            ))}
        </div>
        <div className="absolute inset-0 pointer-events-none grid" 
             style={{ 
                gridTemplateColumns: `repeat(${mapData.length}, 40px)`,
                gridTemplateRows: `repeat(${mapData.length}, 40px)`,
                gap: '1px'
             }}>
             <AnimatePresence>
                {renderShotEffect()}
             </AnimatePresence>
        </div>
    </div>
  );
};