import React from 'react';
import { Unit } from '../../types'; // Giả định Unit có các trường cần thiết
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface Props {
    unit: Unit;
    isEnemy?: boolean;
    // THÊM: Prop isGhost để render đơn vị ở chế độ preview (deploy)
    isGhost?: boolean; 
}

export const UnitRenderer = ({ unit, isEnemy = false, isGhost = false }: Props) => {
    const isHorizontal = !unit.vertical;
    const isStructure = unit.type === 'STRUCTURE';
    
    // Màu sắc
    let themeColor = isEnemy ? 'border-alert bg-alert/20 text-alert' : 'border-radar bg-radar/20 text-radar';
    if (isStructure) {
        themeColor = isEnemy ? 'border-alert bg-alert/40 text-alert' : 'border-cyan-500 bg-cyan-500/30 text-cyan-300';
    }
    
    // Nếu là Ghost, dùng màu preview và làm mờ
    const ghostClass = isGhost ? 'opacity-40 brightness-150 border-white/50 bg-white/10' : '';
    
    // Icon cho structure
    const getIcon = (code: string) => {
        switch(code) {
            case 'SILO': return '🚀';
            case 'AIRFIELD': return '✈️';
            case 'LIGHTHOUSE': return '💡';
            case 'NUCLEAR_PLANT': return '☢️';
            case 'SUPPLY': return '➕';
            default: return null;
        }
    }

    // Nếu là Ghost, không cần hiển thị các hiệu ứng trạng thái phức tạp
    if (isGhost) {
        themeColor = isHorizontal ? 'border-green-400 bg-green-400/20' : 'border-green-400 bg-green-400/20';
    }

    return (
        <div className={clsx("relative w-full h-full pointer-events-none transition-all duration-200", unit.isImmobilized && "opacity-80", ghostClass)}>
            
            {/* Hiệu ứng bị lộ diện (Revealed) */}
            {!isGhost && unit.revealedTurns && unit.revealedTurns > 0 && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-50 text-xl animate-pulse">
                    👁️
                </div>
            )}

            {/* Render từng Cell */}
            {unit.cells.map((cell, idx) => (
                <div 
                    key={`${unit.id}_c_${idx}`}
                    className={clsx(
                        "absolute border box-border flex items-center justify-center transition-all duration-300",
                        cell.hit && !isGhost
                            ? "bg-neutral-950 border-red-600 text-red-600 z-10" 
                            : `${themeColor} z-0`,
                        isStructure ? "rounded-sm" : "rounded-none",
                    )}
                    style={{
                        // Tính toán vị trí offset trong container unit (100% là 1 cell)
                        // Sai lầm trong code cũ là dùng (cell.x - unit.x) & (cell.y - unit.y)
                        // Cell đơn giản chỉ là idx: 0, 1, 2...
                        left: isHorizontal ? `${idx * 100}%` : 0,
                        top: !isHorizontal ? `${idx * 100}%` : 0,
                        width: '100%',
                        height: '100%',
                    }}
                >
                    {/* Mã tàu/công trình ở cell đầu */}
                    {idx === 0 && (
                        <span className="text-[10px] font-mono font-bold drop-shadow-md">
                            {getIcon(unit.code) || unit.code}
                        </span>
                    )}
                    {!isGhost && cell.hit && <span className="text-lg animate-pulse">✖</span>}
                </div>
            ))}

            {/* Info Overlay (Chỉ hiển thị cho unit thật) */}
            {!isGhost && (
                <div 
                    className="absolute z-20 flex flex-col items-center w-full pointer-events-none"
                    style={{ 
                        // Căn giữa tổng thể unit
                        top: '50%', 
                        left: isHorizontal ? `${(unit.cells.length * 100) / 2}%` : '50%',
                        transform: 'translate(-50%, -50%)',
                        // Đặt chiều rộng lớn hơn 1 cell để hiển thị info
                        width: isHorizontal ? '120px' : '40px' 
                    }}
                >
                    {/* Health Bar */}
                    {!unit.isSunk && (
                        <div className="w-10 h-1 bg-gray-900 border border-gray-700 mb-1">
                            <motion.div 
                                initial={{ width: '100%' }}
                                animate={{ width: `${(unit.hp / unit.maxHp) * 100}%` }}
                                className={clsx("h-full", unit.hp < unit.maxHp * 0.3 ? "bg-red-500" : "bg-green-500")}
                            />
                        </div>
                    )}

                    {/* Status Badges */}
                    <div className="flex flex-col gap-0.5 items-center">
                        {unit.isImmobilized && <span className="text-[8px] bg-black/80 text-red-500 px-1 border border-red-500">BROKEN</span>}
                        
                        {/* Hiển thị thời gian nạp đạn của SILO */}
                        {unit.code === 'SILO' && !unit.isSunk && (
                            <span className={clsx("text-[8px] px-1 border font-bold", unit.chargingTurns! > 0 ? "bg-black text-yellow-500 border-yellow-500" : "bg-red-600 text-white border-red-500 animate-pulse")}>
                                {unit.chargingTurns! > 0 ? `LOAD: ${unit.chargingTurns}T` : 'NUKE READY'}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};