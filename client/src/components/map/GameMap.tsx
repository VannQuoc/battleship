import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { TERRAIN, UNIT_DEFINITIONS } from '../../config/constants';
import { UnitRenderer } from './UnitRenderer';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
// Sửa lỗi: Giả định Player type đã được export trong '../../types/index.ts'
import { Player } from '../../types'; 

interface MapProps {
    interactive?: boolean;
    onCellClick?: (x: number, y: number) => void;
    onCellHover?: (x: number, y: number) => void; // Prop đã được thêm
    hoverMode?: 'move' | 'attack' | 'deploy' | 'item' | null;
    validMoves?: string[]; // "x,y"
    selectedUnitId?: string | null; 
    
    // Prop để override me object (dùng cho SetupScreen)
    me?: Player; 
}

export const GameMap = ({ 
    interactive, 
    onCellClick, 
    onCellHover, // <<< TRÍCH XUẤT PROP ĐÃ KHẮC PHỤC LỖI Cannot find name 'onCellHover'
    hoverMode, 
    validMoves, 
    selectedUnitId, 
    me: meProp 
}: MapProps) => {
    // Ưu tiên dùng meProp (từ SetupScreen) nếu tồn tại, ngược lại lấy từ store
    const storeData = useGameStore();
    const me = meProp || storeData.me; 
    const { mapData, opponent, lastEffect } = storeData;
    const [hoverPos, setHoverPos] = React.useState<{x:number, y:number} | null>(null);

    if (!mapData || mapData.length === 0) return <div className="text-hologram animate-pulse font-mono">INITIALIZING RADAR...</div>;

    // --- Logic Fog of War (Client Side Estimation) ---
    const visibleCells = new Set<string>();
    me?.fleet.forEach(u => {
        if (u.isSunk) return;
        const def = UNIT_DEFINITIONS[u.code];
        // Sử dụng logic tầm nhìn của Unit. Trong SetupScreen, meProp được dùng.
        const vision = def?.vision || 2; 
        
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

    // --- Logic Raycast Visualization (Đường đạn trực tiếp) ---
    let isLineBlocked = false;
    let lineCells: string[] = [];

    if (interactive && hoverMode === 'attack' && selectedUnitId && hoverPos) {
        // me là meProp (nếu đang setup) hoặc storeData.me (nếu đang battle)
        const unit = me?.fleet.find(u => u.id === selectedUnitId); 
        const def = unit ? UNIT_DEFINITIONS[unit.code] : null;

        if (unit && def?.trajectory === 'DIRECT') {
            let x0 = unit.x, y0 = unit.y;
            const x1 = hoverPos.x, y1 = hoverPos.y;
            // Thuật toán Bresenham's Line Algorithm
            const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
            const sx = (x0 < x1) ? 1 : -1;
            const sy = (y0 < y1) ? 1 : -1;
            let err = dx - dy;

            while(true) {
                if (x0 === x1 && y0 === y1) break;
                
                if (!(x0 === unit.x && y0 === unit.y)) { // Bỏ qua ô xuất phát
                    const cellKey = `${x0},${y0}`;
                    lineCells.push(cellKey);
                    
                    if (mapData[x0] && mapData[x0][y0] === TERRAIN.ISLAND) {
                        isLineBlocked = true;
                    }
                }
                
                const e2 = 2 * err;
                if (e2 > -dy) { err -= dy; x0 += sx; }
                if (e2 < dx) { err += dx; y0 += sy; }
            }
        }
    }

    // Hiệu ứng bắn (Shot Effect) từ Server gửi về
    const renderShotEffect = () => {
        if(lastEffect?.type === 'SHOT' && lastEffect.x !== undefined) {
            return (
                <motion.div
                    initial={{ opacity: 1, scale: 0.5 }}
                    animate={{ opacity: 0, scale: 2 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
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
        <div className="relative inline-block bg-sea-950 p-1 border-2 border-hologram/30 shadow-[0_0_30px_rgba(6,182,212,0.1)] rounded-lg overflow-hidden select-none"
             onMouseLeave={() => setHoverPos(null)}
        >
            {/* Grid Container */}
            <div 
                className="grid gap-[1px] bg-hologram/10"
                style={{ 
                    gridTemplateColumns: `repeat(${mapData.length}, 32px)`, 
                    gridTemplateRows: `repeat(${mapData.length}, 32px)`
                }}
            >
                {mapData.map((row, x) => (
                    row.map((terrain, y) => {
                        const cellKey = `${x},${y}`;
                        const isVisible = visibleCells.has(cellKey) || (terrain === TERRAIN.ISLAND);
                        const isValidMove = validMoves?.includes(cellKey);
                        
                        // --- Terrain Visuals ---
                        let bgClass = 'bg-sea-900/80';
                        let content = null;

                        if (terrain === TERRAIN.ISLAND) {
                            bgClass = 'bg-neutral-600 border-neutral-500 shadow-inner';
                            content = <span className="text-[10px] opacity-40">⛰️</span>;
                        } else if (terrain === TERRAIN.REEF) {
                            bgClass = 'bg-cyan-900/50 border border-dashed border-cyan-700/80';
                            content = <span className="text-[8px] text-cyan-600">〰️</span>;
                        }

                        // --- Fog Overlay ---
                        // isSetupScreen: Chỉ ẩn Fog of War khi đang trong màn hình Setup
                        const isSetupScreen = !!meProp; 
                        const fogClass = (!isVisible && !isSetupScreen) ? "brightness-[0.2] grayscale" : "";

                        // --- Raycast Line Highlight ---
                        const isRayPath = lineCells.includes(cellKey);
                        
                        return (
                            <div 
                                key={cellKey}
                                onClick={() => interactive && onCellClick && onCellClick(x, y)}
                                // SỬ DỤNG PROP ONCELLHOVER
                                onMouseEnter={() => interactive && onCellHover && onCellHover(x, y)}
                                onMouseLeave={() => interactive && onCellHover && onCellHover(-1, -1)} 
                                className={clsx(
                                    "relative w-8 h-8 flex items-center justify-center cursor-crosshair transition-colors duration-100",
                                    bgClass, fogClass,
                                    interactive && "hover:border hover:border-hologram/50 hover:bg-white/10",
                                    isValidMove && "bg-radar/30 border border-radar animate-pulse", 
                                    hoverMode === 'attack' && interactive && "hover:bg-alert/30 hover:border-alert", 
                                    hoverMode === 'item' && interactive && "hover:bg-yellow-400/30", 
                                    hoverMode === 'deploy' && interactive && "hover:bg-green-400/30 hover:border-green-400",
                                    isRayPath && (isLineBlocked ? "bg-red-900/50" : "bg-green-900/50"),
                                )}
                            >
                                {content}

                                {/* Render Quân Mình (Dùng me.fleet, là unit thật HOẶC unit ảo từ meProp) */}
                                {me?.fleet.map(u => {
                                    if (u.x === x && u.y === y) {
                                        // Logic xác định đơn vị ảo (Ghost): Nếu ID bắt đầu bằng 'temp-' hoặc đang ở chế độ deploy
                                        const isGhost = u.id?.startsWith('temp-') || (hoverMode === 'deploy' && u.id === 'preview');
                                        
                                        return (
                                            <div key={u.id} className="absolute top-0 left-0 z-10"
                                                style={{ 
                                                    width: u.vertical ? '100%' : `${u.cells.length * 100}%`,
                                                    height: u.vertical ? `${u.cells.length * 100}%` : '100%'
                                                }}
                                            >
                                                <UnitRenderer unit={u} isGhost={isGhost} />
                                            </div>
                                        )
                                    }
                                    return null;
                                })}

                                {/* Render Quân Địch (Chỉ dùng dữ liệu store và chỉ render khi isVisible) */}
                                {opponent?.fleet.map(u => {
                                    if (u.x === x && u.y === y && isVisible) { 
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