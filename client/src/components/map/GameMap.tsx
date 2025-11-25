import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { TERRAIN, UNIT_DEFINITIONS } from '../../config/constants';
import { UnitRenderer } from './UnitRenderer';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface MapProps {
    interactive?: boolean;
    onCellClick?: (x: number, y: number) => void;
    hoverMode?: 'move' | 'attack' | 'deploy' | 'item' | null;
    validMoves?: string[]; // "x,y"
    attackTarget?: string | null; // ID của tàu đang bị ngắm (cho Direct Fire visual)
}

export const GameMap = ({ interactive, onCellClick, hoverMode, validMoves }: MapProps) => {
  const { mapData, me, opponent, lastEffect } = useGameStore();

  if (!mapData || mapData.length === 0) return <div className="text-hologram animate-pulse font-mono">INITIALIZING RADAR...</div>;

  // --- Logic Fog of War ---
  // Tính toán các ô được nhìn thấy bởi phe ta
  const visibleCells = new Set<string>();
  me?.fleet.forEach(u => {
      if (u.isSunk) return;
      const def = UNIT_DEFINITIONS[u.code];
      const vision = def?.vision || 2;
      
      // Vision đơn giản: Hình vuông bán kính vision (Chebyshev)
      // Server dùng logic phức tạp hơn, Client chỉ cần ước lượng để vẽ Fog đẹp
      for (let dx = -vision; dx <= vision; dx++) {
          for (let dy = -vision; dy <= vision; dy++) {
              const vx = u.x + dx;
              const vy = u.y + dy;
              if (vx >= 0 && vy >= 0 && vx < mapData.length && vy < mapData.length) {
                  visibleCells.add(`${vx},${vy}`);
              }
          }
      }
  });

  // Hiệu ứng bắn (Shot Effect) từ Server gửi về
  const renderShotEffect = () => {
      if(lastEffect?.type === 'SHOT' && lastEffect.x !== undefined) {
          return (
            <motion.div
                initial={{ opacity: 1, scale: 0.5 }}
                animate={{ opacity: 0, scale: 2 }}
                key={`shot-${lastEffect.x}-${lastEffect.y}-${Date.now()}`}
                className={clsx(
                    "absolute w-full h-full z-50 rounded-full border-2",
                    lastEffect.result === 'HIT' || lastEffect.result === 'SUNK' ? "bg-red-500/50 border-red-500" : "bg-white/30 border-white"
                )}
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
    <div className="relative inline-block bg-sea-950 p-1 border-2 border-hologram/30 shadow-[0_0_30px_rgba(6,182,212,0.1)] rounded-lg overflow-hidden">
        {/* Grid Container */}
        <div 
            className="grid gap-[1px] bg-hologram/10"
            style={{ 
                gridTemplateColumns: `repeat(${mapData.length}, 32px)`, // 32px per cell
                gridTemplateRows: `repeat(${mapData.length}, 32px)`
            }}
        >
            {mapData.map((row, x) => (
                row.map((terrain, y) => {
                    const cellKey = `${x},${y}`;
                    const isVisible = visibleCells.has(cellKey);
                    const isValidMove = validMoves?.includes(cellKey);
                    
                    // --- Terrain Visuals ---
                    let bgClass = 'bg-sea-900/80'; // Water (Mặc định)
                    let content = null;

                    if (terrain === TERRAIN.ISLAND) {
                        bgClass = 'bg-neutral-700 border-neutral-600 shadow-inner';
                        content = <span className="text-[10px] opacity-30">⛰️</span>;
                    } else if (terrain === TERRAIN.REEF) {
                        bgClass = 'bg-cyan-900/40 border border-dashed border-cyan-800';
                        content = <span className="text-[8px] text-cyan-700">ww</span>;
                    }

                    // --- Fog Overlay ---
                    // Nếu không nhìn thấy và không phải đảo (đảo luôn hiện địa hình), thì phủ tối
                    const fogClass = (!isVisible && terrain !== TERRAIN.ISLAND) ? "brightness-50 grayscale" : "";

                    return (
                        <div 
                            key={cellKey}
                            onClick={() => interactive && onCellClick && onCellClick(x, y)}
                            className={clsx(
                                "relative w-8 h-8 flex items-center justify-center cursor-crosshair transition-colors duration-200",
                                bgClass, fogClass,
                                interactive && "hover:border hover:border-hologram/50 hover:bg-hologram/10",
                                isValidMove && "bg-radar/20 animate-pulse border border-radar", // Highlight Move
                                hoverMode === 'attack' && interactive && "hover:bg-alert/20 hover:border-alert", // Highlight Attack
                                hoverMode === 'item' && interactive && "hover:bg-yellow-400/20"
                            )}
                        >
                            {content}

                            {/* Render Quân Mình */}
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

                            {/* Render Quân Địch (Đã lộ diện) */}
                            {opponent?.fleet.map(u => {
                                if (u.x === x && u.y === y) {
                                     return (
                                        <div key={u.id} className="absolute top-0 left-0 z-10"
                                            style={{ 
                                                width: u.vertical ? '100%' : `${u.cells.length * 100}%`,
                                                height: u.vertical ? `${u.cells.length * 100}%` : '100%'
                                            }}
                                        >
                                            <UnitRenderer unit={u} isEnemy />
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

        {/* FX Layer */}
        <div className="absolute inset-0 pointer-events-none grid" 
             style={{ 
                gridTemplateColumns: `repeat(${mapData.length}, 32px)`,
                gridTemplateRows: `repeat(${mapData.length}, 32px)`,
                gap: '1px'
             }}>
             <AnimatePresence>
                {renderShotEffect()}
             </AnimatePresence>
        </div>
        
        {/* Radar Scan Line Effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 bg-scan-line">
             <div className="w-full h-[5px] bg-hologram shadow-[0_0_10px_#06b6d4] animate-scan" />
        </div>
    </div>
  );
};