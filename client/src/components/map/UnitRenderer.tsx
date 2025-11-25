import React from 'react';
import { Unit } from '../../types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

export const UnitRenderer = ({ unit, isEnemy = false }: { unit: Unit, isEnemy?: boolean }) => {
  const isHorizontal = !unit.vertical;
  
  // Tính toán kích thước dựa trên size (Mỗi ô 40px)
  const length = unit.cells.length * 100 + '%'; // Chiếm bao nhiêu % ô cha (nếu render đè)
  
  // Màu sắc dựa trên phe
  const baseColor = isEnemy ? 'bg-alert' : 'bg-radar';
  const borderColor = isEnemy ? 'border-red-500' : 'border-emerald-400';

  return (
    <div className="relative w-full h-full pointer-events-none">
      {/* Render từng đốt tàu để hiển thị hỏng hóc */}
      {unit.cells.map((cell, idx) => (
        <div 
           key={`${unit.id}-cell-${idx}`}
           className={clsx(
             "absolute w-full h-full border border-opacity-50 flex items-center justify-center text-[10px] font-bold transition-colors duration-300",
             borderColor,
             // Logic Hit Part: Nếu đốt bị hit -> Màu đen khói, ngược lại -> Màu tàu
             cell.hit ? "bg-neutral-900 text-red-500" : `${baseColor} text-black opacity-80`
           )}
           style={{
             // Tính vị trí absolute tương đối với ô gốc (0,0) của Unit
             left: isHorizontal ? `${(cell.x - unit.x) * 100}%` : 0,
             top: !isHorizontal ? `${(cell.y - unit.y) * 100}%` : 0,
           }}
        >
           {/* Chỉ hiện tên tàu ở đốt đầu tiên */}
           {idx === 0 && <span className="z-10">{unit.code}</span>}
           
           {/* Hiệu ứng nổ/khói nếu bị hit */}
           {cell.hit && (
             <motion.div 
               initial={{ scale: 0 }} animate={{ scale: 1 }}
               className="absolute inset-0 bg-orange-500/30 animate-pulse"
             />
           )}
        </div>
      ))}

      {/* Status Icons Overlay (Hiển thị ở giữa tàu) */}
      <div 
        className="absolute z-20 flex flex-col items-center justify-center w-full pointer-events-none"
        style={{ 
            top: '50%', left: isHorizontal ? `${(unit.cells.length * 100) / 2}%` : '50%',
            transform: 'translate(-50%, -50%)'
        }}
      >
          {/* Health Bar Mini */}
          <div className="w-8 h-1 bg-gray-700 mt-1">
              <div 
                className={clsx("h-full transition-all", unit.hp < unit.maxHp * 0.5 ? "bg-red-500" : "bg-green-500")} 
                style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }}
              />
          </div>

          {unit.isImmobilized && <span className="text-xl">⚓</span>}
          {unit.chargingTurns !== undefined && unit.chargingTurns > 0 && (
              <span className="text-[8px] bg-black text-yellow-400 px-1 rounded">LOAD: {unit.chargingTurns}</span>
          )}
      </div>
    </div>
  );
};