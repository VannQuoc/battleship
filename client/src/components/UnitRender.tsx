import React from 'react';
import { Unit } from '../types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface Props {
  unit: Unit;
  isEnemy?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}

// Map mã tàu sang màu/icon đơn giản
const UNIT_COLORS: Record<string, string> = {
  CV: 'bg-purple-600',
  BB: 'bg-blue-700',
  CL: 'bg-blue-500',
  DD: 'bg-blue-400',
  SS: 'bg-teal-600',
  SILO: 'bg-orange-600',
  AIRFIELD: 'bg-gray-600',
  SUPPLY: 'bg-green-600',
  ISLAND: 'bg-slate-500', 
};

export const UnitRender: React.FC<Props> = ({ unit, isEnemy, onClick, isSelected }) => {
  const isVertical = unit.vertical;
  const baseColor = isEnemy ? 'bg-alert' : UNIT_COLORS[unit.code] || 'bg-gray-500';

  // Tính toán kích thước grid: mỗi ô 100%
  // unit.x, unit.y là tọa độ gốc. Component này sẽ nằm trong 1 ô div absolute.
  
  return (
    <motion.div
      layoutId={`unit-${unit.id}`}
      className={clsx(
        "absolute z-10 transition-all duration-300 cursor-pointer border-2",
        isSelected ? "border-white shadow-[0_0_15px_rgba(255,255,255,0.6)]" : "border-black/30",
        unit.isImmobilized && "opacity-70 grayscale",
        isVertical ? "flex-col" : "flex-row"
      )}
      style={{
        width: isVertical ? '100%' : `${unit.definition?.size || unit.cells.length * 100}%`,
        height: isVertical ? `${unit.definition?.size || unit.cells.length * 100}%` : '100%',
        left: `${unit.x * 100}%`, // Logic parent sẽ là relative grid cell 
        top: `${unit.y * 100}%`,  // NHƯNG ở đây ta render absolute trên Grid tổng thì đúng hơn
        // UPDATE: Để dễ xử lý, ta sẽ render UnitRender đè lên GridMap, tính theo % absolute
      }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      {/* Container của các đốt tàu */}
      <div className={clsx("w-full h-full flex", isVertical ? "flex-col" : "flex-row")}>
        {unit.cells.map((cell, idx) => (
          <div key={idx} className="flex-1 relative border border-black/20">
            {/* Body tàu */}
            <div className={clsx("w-full h-full", baseColor, cell.hit && "bg-black/80 animate-pulse")} />
            
            {/* Hiệu ứng cháy nếu Hit */}
            {cell.hit && <span className="absolute inset-0 flex items-center justify-center text-orange-500 text-xs font-bold">❌</span>}
          </div>
        ))}
      </div>

      {/* Info Bar (HP / Name) */}
      <div className="absolute -top-6 left-0 w-full flex flex-col items-center pointer-events-none">
        <span className="text-[10px] font-mono text-white bg-black/50 px-1 rounded">{unit.code}</span>
        <div className="w-full h-1 bg-gray-700 mt-0.5">
          <div 
            className={clsx("h-full transition-all", unit.hp < unit.maxHp * 0.5 ? "bg-red-500" : "bg-green-500")} 
            style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }} 
          />
        </div>
        {/* Silo Charging Bar */}
        {unit.code === 'SILO' && (
             <div className="w-full h-1 bg-yellow-900 mt-0.5">
                <div className="h-full bg-yellow-400" style={{ width: `${(5 - (unit.chargingTurns || 0)) / 5 * 100}%` }} />
             </div>
        )}
      </div>
    </motion.div>
  );
};