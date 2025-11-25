import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { TerrainType, Unit } from '../../types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

// Helper render từng ô
const Cell = ({ x, y, terrain, onClick, content }: any) => {
  // Mapping Terrain Visuals (Requirement 5.2 & 6)
  const getTerrainClass = (t: TerrainType) => {
    switch(t) {
      case 1: return 'bg-neutral-800 border-neutral-600 shadow-inner'; // ISLAND (Khối nổi)
      case 2: return 'bg-cyan-900/50 border-cyan-800/30'; // REEF (Đá ngầm)
      default: return 'bg-sea-900/30 border-sea-800/30 hover:bg-sea-800/50'; // WATER
    }
  };

  return (
    <div 
      onClick={() => onClick(x, y)}
      className={clsx(
        'relative w-10 h-10 border transition-colors cursor-crosshair',
        getTerrainClass(terrain)
      )}
    >
      {/* Terrain Visual Helper */}
      {terrain === 1 && <span className="absolute text-[8px] text-neutral-500 top-0 left-0">ISLAND</span>}
      {terrain === 2 && <span className="absolute text-[8px] text-cyan-500 top-0 left-0">REEF</span>}
      
      {/* Unit Content */}
      {content}
    </div>
  );
};

// Unit Renderer (Xử lý Cells bị hỏng)
const UnitRenderer = ({ unit }: { unit: Unit }) => {
    // Tính toán vị trí tương đối trong Grid là việc của Parent,
    // Ở đây ta giả sử render đè lên các Cell.
    // Thực tế: Ta nên render Unit ở Layer riêng hoặc map vào từng cell.
    // Cách đơn giản nhất cho Grid: Duyệt qua unit.cells để xác định cell nào chứa body unit.
    return null; // Logic xử lý trong Main Map Loop
};

export const GameMap = ({ interactive = false, onCellClick }: any) => {
  const { mapData, me, opponent } = useGameStore();

  if (!mapData || mapData.length === 0) return <div className="text-hologram animate-pulse">Initializing Radar...</div>;

  // Helper: Tìm xem ô (x,y) có Unit nào không
  const getUnitAt = (x: number, y: number) => {
    // 1. Check My Fleet
    const myUnit = me?.fleet.find(u => u.cells.some(c => c.x === x && c.y === y));
    if (myUnit) {
        const cellInfo = myUnit.cells.find(c => c.x === x && c.y === y);
        return (
            <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className={clsx(
                    "w-full h-full rounded-sm flex items-center justify-center font-bold text-xs border",
                    myUnit.isSunk ? "bg-gray-700 opacity-50" : "bg-radar text-black border-green-400",
                    cellInfo?.hit && "bg-red-900 text-white" // Đốt bị hỏng
                )}
            >
               {myUnit.code}
            </motion.div>
        );
    }
    
    // 2. Check Opponent Fleet (Chỉ hiện những con server gửi về)
    const opUnit = opponent?.fleet.find(u => u.x !== undefined && u.cells && u.cells.some(c => c.x === x && c.y === y));
    // Note: Opponent fleet từ server gửi về dạng PublicUnit, cần check kỹ
    if(opponent?.fleet) {
        // Logic tìm Unit đối thủ (tùy vào cấu trúc chính xác server trả về)
        // ...
    }
    
    return null;
  };

  return (
    <div 
        className="grid gap-[1px] bg-hologram/20 p-1 rounded border border-hologram shadow-[0_0_15px_rgba(6,182,212,0.3)]"
        style={{ gridTemplateColumns: `repeat(${mapData.length}, minmax(0, 1fr))` }}
    >
      {mapData.map((row, x) => (
        row.map((terrain, y) => (
          <Cell 
            key={`${x}-${y}`} 
            x={x} y={y} 
            terrain={terrain} 
            content={getUnitAt(x, y)}
            onClick={interactive ? onCellClick : undefined}
          />
        ))
      ))}
    </div>
  );
};