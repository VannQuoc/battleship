// client/src/components/map/UnitRenderer.tsx
import { useMemo } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { CONSTANTS, UNIT_DEFINITIONS } from '../../config/constants';
import type { Unit } from '../../types';

// ============================================================
// TYPES
// ============================================================
interface UnitRendererProps {
  unit: Unit;
  isEnemy?: boolean;
  preview?: boolean;
  isValid?: boolean;
  selected?: boolean;
  cellSize?: number;
}

// ============================================================
// ICON HELPERS
// ============================================================
const getUnitIcon = (code: string): string => {
  switch (code) {
    // Ships
    case 'CV': return '🛳️';
    case 'BB': return '⚓';
    case 'CL': return '🚢';
    case 'DD': return '🔱';
    case 'SS': return '🦈';
    // Structures
    case 'SILO': return '🚀';
    case 'AIRFIELD': return '✈️';
    case 'LIGHTHOUSE': return '💡';
    case 'NUCLEAR_PLANT': return '☢️';
    case 'SUPPLY': return '➕';
    default: return '📍';
  }
};

// ============================================================
// COMPONENT
// ============================================================
export const UnitRenderer = ({
  unit,
  isEnemy = false,
  preview = false,
  isValid = true,
  selected = false,
  cellSize = 28,
}: UnitRendererProps) => {
  // Don't render sunk units (unless preview)
  if (unit.isSunk && !preview) return null;

  const def = UNIT_DEFINITIONS[unit.code];
  const isStructure = unit.type === 'STRUCTURE';
  const isStealth = def?.isStealth;
  const isHorizontal = !unit.vertical;
  const size = unit.cells?.length || def?.size || 1;

  // --- Critical State (< 50% HP) ---
  const isCritical = useMemo(() => {
    return unit.hp < unit.maxHp * CONSTANTS.CRITICAL_THRESHOLD;
  }, [unit.hp, unit.maxHp]);

  // --- HP Percentage ---
  const hpPercent = Math.round((unit.hp / unit.maxHp) * 100);

  // --- Theme Colors ---
  const getThemeColors = () => {
    if (preview) {
      return isValid
        ? 'border-emerald-500 bg-emerald-500/30 text-emerald-300'
        : 'border-red-500 bg-red-500/30 text-red-300';
    }

    if (isEnemy) {
      return isStructure
        ? 'border-red-600 bg-red-600/30 text-red-300'
        : 'border-red-500 bg-red-500/20 text-red-400';
    }

    if (isStructure) {
      return 'border-purple-500 bg-purple-500/30 text-purple-300';
    }

    return 'border-cyan-500 bg-cyan-500/20 text-cyan-300';
  };

  const themeColors = getThemeColors();

  // --- Calculate dimensions ---
  const width = isHorizontal ? size * cellSize + (size - 1) : cellSize;
  const height = !isHorizontal ? size * cellSize + (size - 1) : cellSize;

  return (
    <div
      className={clsx(
        'relative transition-all duration-200',
        preview && 'opacity-70',
        selected && !preview && 'z-30'
      )}
      style={{ width, height }}
    >
      {/* ==================== STATUS ICONS (Above Unit) ==================== */}
      {!preview && (
        <div className="absolute -top-6 left-0 right-0 flex justify-center gap-1 z-50">
          {/* Revealed Eye Icon */}
          {(unit.revealedTurns && unit.revealedTurns > 0) || unit.isRevealed ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-red-500/80 rounded-full p-0.5 shadow-lg shadow-red-500/50"
              title="Đang bị lộ diện"
            >
              <span className="text-xs">👁️</span>
            </motion.div>
          ) : null}

          {/* Critical / Broken Engine Icon */}
          {isCritical && !isEnemy && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-orange-500/80 rounded-full p-0.5 shadow-lg shadow-orange-500/50 animate-bounce"
              title="Động cơ hỏng (< 50% HP)"
            >
              <span className="text-xs">⚓</span>
            </motion.div>
          )}

          {/* Stealth Icon */}
          {isStealth && !isEnemy && (
            <div
              className="bg-slate-700/80 rounded-full p-0.5"
              title="Đang tàng hình"
            >
              <span className="text-xs">👻</span>
            </div>
          )}

          {/* Assassination Timer (Future) */}
          {/* Add logic if server sends mercenary target info */}
        </div>
      )}

      {/* ==================== MAIN UNIT BODY ==================== */}
      <div
        className={clsx(
          'w-full h-full border-2 rounded-sm flex items-center justify-center relative overflow-hidden',
          themeColors,
          preview && 'border-dashed',
          selected && 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-slate-900',
          unit.isImmobilized && !preview && 'opacity-70'
        )}
      >
        {/* Unit Icon/Code */}
        <span className="text-[10px] font-bold font-mono drop-shadow-md z-10 flex items-center gap-0.5">
          <span className="text-sm">{getUnitIcon(unit.code)}</span>
          {size > 2 && <span className="opacity-70">{unit.code}</span>}
        </span>

        {/* Hit markers for each cell */}
        {!preview && unit.cells && (
          <div
            className="absolute inset-0 flex"
            style={{
              flexDirection: isHorizontal ? 'row' : 'column',
            }}
          >
            {unit.cells.map((cell, idx) => (
              <div
                key={idx}
                className={clsx(
                  'flex-1 flex items-center justify-center',
                  cell.hit && 'bg-red-900/60'
                )}
              >
                {cell.hit && (
                  <span className="text-red-400 text-lg font-bold animate-pulse">✖</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sunk Overlay */}
        {unit.isSunk && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <span className="text-2xl">💀</span>
          </div>
        )}
      </div>

      {/* ==================== HP BAR (Below or Above) ==================== */}
      {!preview && !unit.isSunk && (
        <div className="absolute -bottom-2 left-0 right-0 flex flex-col items-center z-40">
          {/* HP Bar Container */}
          <div
            className="h-1.5 bg-slate-800/80 border border-slate-600 rounded-full overflow-hidden shadow-md"
            style={{ width: Math.min(width, 40) }}
          >
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: `${hpPercent}%` }}
              transition={{ duration: 0.3 }}
              className={clsx(
                'h-full rounded-full',
                hpPercent > 50
                  ? 'bg-emerald-500'
                  : hpPercent > 25
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              )}
            />
          </div>

          {/* HP Text (on hover or always for structures) */}
          {(isStructure || selected) && (
            <span className="text-[8px] font-mono text-slate-400 mt-0.5">
              {unit.hp}/{unit.maxHp}
            </span>
          )}
        </div>
      )}

      {/* ==================== SILO CHARGING BAR ==================== */}
      {unit.code === 'SILO' && !preview && !unit.isSunk && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-50">
          <div
            className={clsx(
              'px-2 py-0.5 rounded text-[9px] font-bold font-mono border shadow-lg',
              (unit.chargingTurns || 0) > 0
                ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                : 'bg-red-600/30 border-red-500 text-red-400 animate-pulse'
            )}
          >
            {(unit.chargingTurns || 0) > 0 ? (
              <>
                <span className="opacity-70">NẠP:</span>{' '}
                <span>{CONSTANTS.SILO_CHARGE_TURNS - (unit.chargingTurns || 0)}/{CONSTANTS.SILO_CHARGE_TURNS}</span>
              </>
            ) : (
              <>🚀 SẴN SÀNG</>
            )}
          </div>
        </div>
      )}

      {/* ==================== STRUCTURE PASSIVE INDICATORS ==================== */}
      {isStructure && !preview && unit.turnCounter !== undefined && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-40">
          {unit.code === 'AIRFIELD' && (
            <span className="text-[8px] text-cyan-400 font-mono">
              ✈️ {unit.turnCounter}/{CONSTANTS.AIRFIELD_SPAWN_TURNS}
            </span>
          )}
          {unit.code === 'NUCLEAR_PLANT' && (
            <span className="text-[8px] text-yellow-400 font-mono">
              ☢️ {unit.turnCounter}/{CONSTANTS.NUCLEAR_PLANT_SPAWN_TURNS}
            </span>
          )}
        </div>
      )}

      {/* ==================== ALWAYS VISIBLE BADGE ==================== */}
      {def?.alwaysVisible && !preview && (
        <div
          className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full flex items-center justify-center z-50"
          title="Luôn hiển thị cho địch"
        >
          <span className="text-[6px]">⚠</span>
        </div>
      )}

      {/* ==================== SELECTION GLOW ==================== */}
      {selected && !preview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute -inset-1 border-2 border-yellow-400 rounded-lg pointer-events-none"
        />
      )}
    </div>
  );
};
