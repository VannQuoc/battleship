import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { UnitRender } from './UnitRender';
import { clsx } from 'clsx';
import { Unit } from '../types';

const CELL_SIZE = 30; // Pixel size (có thể scale theo CSS)

export const GameMap = () => {
  const { mapData, me, opponent, status, moveUnit, fireShot, playerId, turn } = useGameStore();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  
  // Xử lý click vào Map
  const handleCellClick = (x: number, y: number) => {
    // 1. Nếu đang chọn tàu của mình -> Di chuyển
    if (selectedUnitId && status === 'BATTLE') {
        const myUnit = me.fleet.find(u => u.id === selectedUnitId);
        
        // Nếu click vào chính nó -> Bỏ chọn
        if (myUnit && myUnit.x === x && myUnit.y === y) {
            setSelectedUnitId(null);
            return;
        }

        // Logic Di chuyển hoặc Bắn
        // Ở đây chia đơn giản: Click ô trống = Move, Click ô địch/nghi ngờ = Bắn
        // Để UX tốt hơn: Cần Mode Switch (Move/Attack). 
        // V3.0 Simple UX: Double Click để Move? Hoặc check if enemy present.
        
        // Mặc định: Move
        if (myUnit && !myUnit.isImmobilized) {
            moveUnit(selectedUnitId, x, y);
            setSelectedUnitId(null); // Move xong bỏ chọn
            return;
        }
    }
    
    // 2. Bắn (Nếu là lượt mình và không đang chọn Move)
    if (status === 'BATTLE' && turn === playerId) {
        // Gửi lệnh bắn. Nếu đang chọn unit (selectedUnitId) thì gửi kèm để ưu tiên tàu đó bắn
        // (Logic Fire Shot V2 hỗ trợ preferredUnitId)
        fireShot(x, y, selectedUnitId);
    }
  };

  // Tính toán Grid Size
  const mapSize = mapData.length || 20;

  return (
    <div className="relative bg-sea-900 border border-holo rounded-lg overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.2)]"
         style={{ width: mapSize * CELL_SIZE, height: mapSize * CELL_SIZE }}>
      
      {/* 1. TERRAIN LAYER */}
      <div className="absolute inset-0 grid" 
           style={{ gridTemplateColumns: `repeat(${mapSize}, 1fr)`, gridTemplateRows: `repeat(${mapSize}, 1fr)` }}>
        {mapData.map((row, x) => row.map((terrain, y) => (
           <div key={`${x}-${y}`} 
                onClick={() => handleCellClick(x, y)}
                className={clsx(
                  "border-[0.5px] border-white/5 transition-colors cursor-crosshair hover:bg-white/10",
                  terrain === 1 && "bg-stone-700", // ISLAND
                  terrain === 2 && "bg-slate-800/80 border-slate-600", // REEF
                  terrain === 0 && "bg-transparent" // WATER
                )}>
                {/* Debug Text Coordinates (Optional) */}
                {/* <span className="text-[8px] text-white/10">{x},{y}</span> */}
           </div>
        )))}
      </div>

      {/* 2. UNIT LAYER (ME) */}
      {me.fleet.map(unit => (
          !unit.isSunk &&
          <div key={unit.id} 
               style={{ 
                   position: 'absolute', 
                   left: unit.x * CELL_SIZE, 
                   top: unit.y * CELL_SIZE,
                   width: unit.vertical ? CELL_SIZE : unit.definition?.size * CELL_SIZE,
                   height: unit.vertical ? unit.definition?.size * CELL_SIZE : CELL_SIZE,
               }}>
            <UnitRender 
                unit={unit} 
                isSelected={selectedUnitId === unit.id} 
                onClick={() => !unit.isSunk && setSelectedUnitId(unit.id)}
            />
          </div>
      ))}

      {/* 3. UNIT LAYER (OPPONENT - Chỉ hiện những con server gửi về) */}
      {opponent.fleet.map((unit: any) => (
          <div key={unit.code + unit.x} // Unit địch có thể chưa có ID nếu chưa lộ hết, dùng tạm
               style={{ 
                   position: 'absolute', 
                   left: unit.x * CELL_SIZE, 
                   top: unit.y * CELL_SIZE,
                   width: unit.vertical ? CELL_SIZE : (unit.code ? 2 : 1) * CELL_SIZE, // Hack size nếu chưa biết
               }}>
             <UnitRender unit={{...unit, cells: Array(unit.size || 1).fill({hit:false})}} isEnemy />
          </div>
      ))}

      {/* 4. FOG OF WAR LAYER (Tính toán Vision Client-side để hiển thị đẹp hơn) */}
      {/* Lưu ý: Backend đã lọc data unit, lớp này chỉ để Visual che terrain/map */}
      {/* Cách làm đơn giản: Backend gửi mapData (Terrain) là visible. Chỉ unit địch bị ẩn. */}
      {/* Nên ta vẽ một lớp overlay mờ lên những vùng không có vision của mình */}
      <FogOverlay mapSize={mapSize} cellSize={CELL_SIZE} myFleet={me.fleet} />

      {/* 5. VISUAL EFFECTS LAYER (Explosions) */}
      <GameEffectsLayer cellSize={CELL_SIZE} />
    </div>
  );
};

// Component: Fog Overlay
const FogOverlay = ({ mapSize, cellSize, myFleet }: {mapSize: number, cellSize: number, myFleet: Unit[]}) => {
    // Logic: Tạo mask SVG hoặc Canvas. Ở đây dùng CSS Grid cells đơn giản.
    // Duyệt qua từng ô, check khoảng cách tới tất cả tàu mình. Nếu > vision -> Render ô đen mờ.
    
    // Tối ưu: Chỉ tính toán khi fleet thay đổi vị trí.
    
    return (
        <div className="absolute inset-0 pointer-events-none grid"
             style={{ gridTemplateColumns: `repeat(${mapSize}, 1fr)` }}>
            {Array(mapSize * mapSize).fill(0).map((_, i) => {
                const x = Math.floor(i / mapSize);
                const y = i % mapSize;
                
                // Check Vision
                let isVisible = false;
                for (const ship of myFleet) {
                    if (ship.isSunk) continue;
                    const range = ship.definition?.vision || 3;
                    const dist = Math.max(Math.abs(ship.x - x), Math.abs(ship.y - y)); // Chebyshev visual
                    if (dist <= range) {
                        isVisible = true;
                        break;
                    }
                }
                
                return (
                    <div key={i} className={clsx("transition-opacity duration-500", isVisible ? "opacity-0" : "bg-black/60 backdrop-blur-[1px]")} />
                );
            })}
        </div>
    )
}

// Component: Xử lý hiệu ứng nổ
const GameEffectsLayer = ({ cellSize }: { cellSize: number }) => {
    const [effects, setEffects] = useState<any[]>([]);

    useEffect(() => {
        const handler = (e: any) => {
            const data = e.detail;
            const id = Date.now();
            setEffects(prev => [...prev, { ...data, id }]);
            setTimeout(() => setEffects(prev => prev.filter(ef => ef.id !== id)), 1000); // Auto remove sau 1s
        };
        window.addEventListener('GAME_EFFECT', handler);
        return () => window.removeEventListener('GAME_EFFECT', handler);
    }, []);

    return (
        <>
            {effects.map(ef => (
                <div key={ef.id} 
                     className="absolute z-50 pointer-events-none flex items-center justify-center text-2xl font-bold animate-ping"
                     style={{ 
                         left: ef.x * cellSize, 
                         top: ef.y * cellSize, 
                         width: cellSize, 
                         height: cellSize,
                         color: ef.result === 'HIT' ? 'orange' : 'white'
                     }}>
                    {ef.result === 'HIT' && '💥'}
                    {ef.result === 'MISS' && '💧'}
                    {ef.result === 'BLOCKED_TERRAIN' && '🏔️'}
                    {ef.type === 'NUKE_EXPLOSION' && '☢️'}
                </div>
            ))}
        </>
    )
}