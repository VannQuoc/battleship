import React from 'react';
import { Unit } from '../../types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface Props {
    unit: Unit;
    isEnemy?: boolean;
}

export const UnitRenderer = ({ unit, isEnemy = false }: Props) => {
  const isHorizontal = !unit.vertical;
  // Phe mình: Xanh Radar. Phe địch: Đỏ Alert.
  const themeColor = isEnemy ? 'border-alert bg-alert/20 text-alert' : 'border-radar bg-radar/20 text-radar';
  
  return (
    <div className="relative w-full h-full pointer-events-none">
      {/* Render từng Cell (Đốt tàu) */}
      {unit.cells.map((cell, idx) => (
        <div 
           key={`${unit.id}_c_${idx}`}
           className={clsx(
             "absolute w-full h-full border box-border flex items-center justify-center transition-all duration-300",
             // Nếu bị HIT -> Màu đen cháy, viền đỏ rực. Nếu không -> Màu phe.
             cell.hit 
                ? "bg-neutral-950 border-red-600 text-red-600 z-10" 
                : `${themeColor} z-0`
           )}
           style={{
             // Tính vị trí absolute dựa trên index trong mảng cells
             left: isHorizontal ? `${(cell.x - unit.x) * 100}%` : 0,
             top: !isHorizontal ? `${(cell.y - unit.y) * 100}%` : 0,
           }}
        >
           {/* Chỉ hiện mã tàu ở đốt đầu tiên */}
           {idx === 0 && <span className="text-[10px] font-mono font-bold">{unit.code}</span>}
           
           {/* Hiệu ứng bị bắn hỏng */}
           {cell.hit && <span className="text-lg animate-pulse">✖</span>}
        </div>
      ))}

      {/* Info Overlay (Máu & Status) - Luôn nằm giữa tàu */}
      <div 
        className="absolute z-20 flex flex-col items-center w-full pointer-events-none"
        style={{ 
            top: '50%', 
            left: isHorizontal ? `${(unit.cells.length * 100) / 2}%` : '50%',
            transform: 'translate(-50%, -50%)',
            width: '100px' // Cố định width để bar không bị co
        }}
      >
          {/* Thanh Máu Mini */}
          {!unit.isSunk && (
            <div className="w-8 h-1 bg-gray-800 border border-gray-600 mb-1">
                <motion.div 
                    initial={{ width: '100%' }}
                    animate={{ width: `${(unit.hp / unit.maxHp) * 100}%` }}
                    className={clsx("h-full", unit.hp < unit.maxHp * 0.3 ? "bg-red-500" : "bg-green-500")}
                />
            </div>
          )}

          <div className="flex gap-1">
            {unit.isImmobilized && <span className="text-xs bg-black px-1 rounded text-red-500 border border-red-500">ANCHORED</span>}
            {unit.chargingTurns !== undefined && unit.chargingTurns > 0 && (
                <span className="text-[8px] bg-black text-yellow-400 px-1 rounded border border-yellow-400">LOAD: {unit.chargingTurns}</span>
            )}
          </div>
      </div>
    </div>
  );
};