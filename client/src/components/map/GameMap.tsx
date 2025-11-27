// client/src/components/map/GameMap.tsx
import { useState, useMemo, useCallback, memo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { TERRAIN, UNIT_DEFINITIONS } from '../../config/constants';
import { UnitRenderer } from './UnitRenderer';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import type { DroneScanMarker, EffectTrigger, ShotMarker, Unit, TerrainType } from '../../types';

// ============================================================
// TYPES
// ============================================================
interface PreviewPlacement {
  code: string;
  x: number;
  y: number;
  vertical: boolean;
  isValid: boolean;
}

interface DronePreview {
  axis: 'row' | 'col';
  index: number;
}

interface MapProps {
  interactive?: boolean;
  onCellClick?: (x: number, y: number) => void;
  onCellHover?: (x: number, y: number) => void;
  hoverMode?: 'move' | 'attack' | 'deploy' | 'item' | null;
  validMoves?: string[];
  selectedUnitId?: string | null;
  me?: { fleet: Unit[] } | null;
  previewPlacement?: PreviewPlacement | null;
  dronePreview?: DronePreview;
  shotMarkers?: ShotMarker[];
  droneMarkers?: DroneScanMarker[];
  droneSelectMode?: boolean; // When true, show clickable row/column labels
}

// ============================================================
// CELL SIZE
// ============================================================
const CELL_SIZE = 28; // pixels

// ============================================================
// CELL COMPONENT (Memoized for performance)
// ============================================================
interface CellProps {
  x: number;
  y: number;
  terrain: TerrainType;
  isVisible: boolean;
  isValidMove: boolean;
  isDronePreview: boolean;
  interactive: boolean;
  hoverMode: MapProps['hoverMode'];
  isDeployMode: boolean;
  shotMarker?: ShotMarker;
  droneMarker?: DroneScanMarker;
  onClick: () => void;
  onHover: () => void;
}

const Cell = memo(function Cell({
  x: _x,
  y: _y,
  terrain,
  isVisible,
  isValidMove,
  isDronePreview,
  interactive,
  hoverMode,
  isDeployMode,
  shotMarker,
  droneMarker,
  onClick,
  onHover,
}: CellProps) {
  // Terrain styling
  let bgClass = 'bg-slate-900/80';
  let content = null;

  if (terrain === TERRAIN.ISLAND) {
    bgClass = 'bg-stone-700 border-stone-600';
    content = <span className="text-[10px] opacity-40">⛰️</span>;
  } else if (terrain === TERRAIN.REEF) {
    bgClass = 'bg-cyan-900/50 border-dashed border-cyan-700/60';
    content = <span className="text-[8px] text-cyan-600/80">〰️</span>;
  } else if (terrain === TERRAIN.STORM) {
    bgClass = 'bg-purple-900/30 border-purple-700/40';
    content = <span className="text-[10px] opacity-40">🌀</span>;
  }

  // Fog overlay
  const fogClass = !isVisible && !isDeployMode ? 'brightness-[0.15] grayscale' : '';
  const shotOverlayClass = shotMarker
    ? shotMarker.isCooldown
      ? 'bg-red-500/50 border border-red-300 animate-pulse'
      : shotMarker.result === 'MISS'
      ? 'bg-yellow-500/30 border border-yellow-400'
      : 'bg-red-500/30 border border-red-500'
    : '';

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      className={clsx(
        'relative flex items-center justify-center transition-all duration-75 border border-transparent',
        bgClass,
        fogClass,
        interactive && 'cursor-crosshair',
        interactive && hoverMode !== 'attack' && 'hover:bg-white/10 hover:border-cyan-500/30',
        isValidMove && 'bg-emerald-500/30 border-emerald-500/50 animate-pulse',
        isDronePreview && 'bg-yellow-500/30 border-yellow-500/50',
        hoverMode === 'attack' && interactive && 'hover:bg-red-500/30 hover:border-red-500/50',
        hoverMode === 'item' && interactive && 'hover:bg-yellow-400/30 hover:border-yellow-400/50',
        hoverMode === 'deploy' && interactive && 'hover:bg-green-400/20 hover:border-green-400/50'
      )}
      style={{ width: CELL_SIZE, height: CELL_SIZE }}
    >
      {content}
      {shotMarker && (
        <>
          <div
            className={clsx(
              'absolute inset-0 pointer-events-none rounded-sm',
              shotOverlayClass
            )}
            title={`Bạn đã bắn: ${shotMarker.result === 'MISS' ? 'Trượt' : shotMarker.result === 'HIT' ? 'Trúng' : shotMarker.result}`}
          />
          {shotMarker.result === 'MISS' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-yellow-400 text-xs font-bold">○</span>
            </div>
          )}
          {shotMarker.result === 'HIT' && !shotMarker.isCooldown && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-red-500 text-sm font-bold">✖</span>
            </div>
          )}
        </>
      )}
      {droneMarker && (
        <div
          className={clsx(
            'absolute top-1 left-1 px-1 rounded-full border text-[10px] font-bold flex items-center justify-center pointer-events-none text-center leading-none drop-shadow',
            droneMarker.colorClass
          )}
          title={droneMarker.title}
        >
          {droneMarker.icon}
        </div>
      )}
    </div>
  );
});

// ============================================================
// GAMEMAP COMPONENT
// ============================================================
export const GameMap = ({
  interactive = false,
  onCellClick,
  onCellHover,
  hoverMode,
  validMoves = [],
  selectedUnitId,
  me,
  previewPlacement,
  dronePreview,
  shotMarkers,
  droneMarkers,
  droneSelectMode = false,
}: MapProps) => {
  const storeData = useGameStore();
  const { mapData, opponent, lastEffect } = storeData;
  type ShotEffect = EffectTrigger & { type: 'SHOT'; x: number; y: number };
  const lastShotEffect: ShotEffect | null =
    lastEffect?.type === 'SHOT' && typeof lastEffect.x === 'number' && typeof lastEffect.y === 'number'
      ? (lastEffect as ShotEffect)
      : null;

  // Use prop `me` if provided, otherwise use store
  const currentMe = me || storeData.me;
  const myFleet = currentMe?.fleet || [];
  
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // --- Loading State ---
  if (!mapData || mapData.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-cyan-400 font-mono animate-pulse">
        <span className="mr-2">📡</span> ĐANG TẢI BẢN ĐỒ...
      </div>
    );
  }

  const mapSize = mapData.length;

  const shotMap = useMemo(() => {
    const map = new Map<string, ShotMarker>();
    shotMarkers?.forEach((marker) => {
      const key = `${marker.x},${marker.y}`;
      map.set(key, marker);
    });
    return map;
  }, [shotMarkers]);

  const droneMap = useMemo(() => {
    const map = new Map<string, DroneScanMarker>();
    droneMarkers?.forEach((marker) => {
      const key = `${marker.x},${marker.y}`;
      map.set(key, marker);
    });
    return map;
  }, [droneMarkers]);

  // --- Calculate Visible Cells (Fog of War) ---
  const visibleCells = useMemo(() => {
    const visible = new Set<string>();

    myFleet.forEach((unit) => {
      if (unit.isSunk) return;
      const def = UNIT_DEFINITIONS[unit.code];
      const vision = def?.vision || 2;

      // Chebyshev distance for square vision
      for (let dx = -vision; dx <= vision; dx++) {
        for (let dy = -vision; dy <= vision; dy++) {
          const vx = unit.x + dx;
          const vy = unit.y + dy;
          if (vx >= 0 && vy >= 0 && vx < mapSize && vy < mapSize) {
            visible.add(`${vx},${vy}`);
          }
        }
      }
    });

    return visible;
  }, [myFleet, mapSize]);

  // Filter opponent units based on actual visibility (extra safety)
  const opponentFleet = useMemo(() => {
    if (!opponent?.fleet) return [];
    return opponent.fleet.filter((u): u is Unit => {
      if (!u || u.isSunk) return false;
      if (u.alwaysVisible || u.isRevealed || (u.revealedTurns && u.revealedTurns > 0)) {
        return true;
      }
      if (u.cells?.some((cell) => visibleCells.has(`${cell.x},${cell.y}`))) {
        return true;
      }
      return false;
    });
  }, [opponent?.fleet, visibleCells]);

  // --- Drone Preview Cells ---
  const dronePreviewCells = useMemo(() => {
    if (!dronePreview) return new Set<string>();
    const cells = new Set<string>();
    
    for (let i = 0; i < mapSize; i++) {
      if (dronePreview.axis === 'row') {
        cells.add(`${dronePreview.index},${i}`);
      } else {
        cells.add(`${i},${dronePreview.index}`);
      }
    }
    return cells;
  }, [dronePreview, mapSize]);

  // --- Is Deploy Mode ---
  const isDeployMode = hoverMode === 'deploy';

  // --- Click Handler ---
  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (interactive && onCellClick) {
        onCellClick(x, y);
      }
    },
    [interactive, onCellClick]
  );

  // --- Hover Handler ---
  const handleCellHover = useCallback(
    (x: number, y: number) => {
      setHoverPos({ x, y });
      if (onCellHover) {
        onCellHover(x, y);
      }
    },
    [onCellHover]
  );

  // --- Unit Click Handler ---
  const handleUnitClick = useCallback(
    (unit: Unit) => {
      if (interactive && onCellClick) {
        onCellClick(unit.x, unit.y);
      }
    },
    [interactive, onCellClick]
  );

  return (
    <div
      className="relative inline-block bg-slate-950 p-1 border-2 border-cyan-500/20 rounded-lg shadow-2xl shadow-cyan-500/5 select-none"
      onMouseLeave={() => {
        setHoverPos(null);
        if (onCellHover) onCellHover(-1, -1);
      }}
    >
      {/* ==================== ROW/COLUMN LABELS (for drone selection) ==================== */}
      {droneSelectMode && (
        <>
          {/* Row labels (left side) */}
          <div
            className="absolute left-0 top-1 flex flex-col pointer-events-auto"
            style={{ width: '24px', marginLeft: '-28px' }}
          >
            {mapData.map((_, rowIndex) => (
              <button
                key={`row-${rowIndex}`}
                onClick={() => onCellClick && onCellClick(rowIndex, -1)} // Use -1 for y to indicate row click
                className="w-6 h-7 text-[10px] font-mono font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 rounded transition-all cursor-pointer flex items-center justify-center"
                title={`Quét hàng ${rowIndex}`}
              >
                {rowIndex}
              </button>
            ))}
          </div>
          {/* Column labels (top side) */}
          <div
            className="absolute top-0 left-1 flex pointer-events-auto"
            style={{ height: '24px', marginTop: '-28px' }}
          >
            {mapData[0]?.map((_, colIndex) => (
              <button
                key={`col-${colIndex}`}
                onClick={() => onCellClick && onCellClick(-1, colIndex)} // Use -1 for x to indicate column click
                className="w-7 h-6 text-[10px] font-mono font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 rounded transition-all cursor-pointer flex items-center justify-center"
                title={`Quét cột ${colIndex}`}
              >
                {colIndex}
              </button>
            ))}
          </div>
        </>
      )}
      {/* ==================== GRID ==================== */}
      <div
        className="grid gap-[1px] bg-cyan-500/5"
        style={{
          gridTemplateColumns: `repeat(${mapSize}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${mapSize}, ${CELL_SIZE}px)`,
        }}
      >
        {mapData.map((row, x) =>
          row.map((terrain, y) => {
            const cellKey = `${x},${y}`;
            const isVisible = visibleCells.has(cellKey) || terrain === TERRAIN.ISLAND || isDeployMode;
            const isValidMove = validMoves.includes(cellKey);
            const isDronePreview = dronePreviewCells.has(cellKey);

            return (
              <Cell
                key={cellKey}
                x={x}
                y={y}
                terrain={terrain}
                isVisible={isVisible}
                isValidMove={isValidMove}
                isDronePreview={isDronePreview}
                interactive={interactive}
                hoverMode={hoverMode}
                isDeployMode={isDeployMode}
                shotMarker={shotMap.get(cellKey)}
                droneMarker={droneMap.get(cellKey)}
                onClick={() => handleCellClick(x, y)}
                onHover={() => handleCellHover(x, y)}
              />
            );
          })
        )}
      </div>

      {/* ==================== UNIT LAYER ==================== */}
      <div
        className="absolute inset-1 pointer-events-none"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${mapSize}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${mapSize}, ${CELL_SIZE}px)`,
          gap: '1px',
        }}
      >
        {/* My Units */}
        {myFleet.map((unit) => {
          if (unit.isSunk) return null;
          const def = UNIT_DEFINITIONS[unit.code];
          if (!def) return null;

          const cols = unit.vertical ? 1 : def.size;
          const rows = unit.vertical ? def.size : 1;

          return (
            <div
              key={unit.id}
              className="pointer-events-auto cursor-pointer"
              style={{
                gridColumn: `${unit.y + 1} / span ${cols}`,
                gridRow: `${unit.x + 1} / span ${rows}`,
              }}
              onClick={() => handleUnitClick(unit)}
            >
              <UnitRenderer
                unit={unit}
                selected={selectedUnitId === unit.id}
                cellSize={CELL_SIZE}
              />
            </div>
          );
        })}

        {/* Opponent Units (only visible ones from server - already filtered) */}
        {opponentFleet.map((unit) => {
          const def = UNIT_DEFINITIONS[unit.code];
          if (!def) return null;

          const cols = unit.vertical ? 1 : (unit.cells?.length || def.size);
          const rows = unit.vertical ? (unit.cells?.length || def.size) : 1;

          return (
            <div
              key={unit.id || `enemy-${unit.x}-${unit.y}`}
              className="pointer-events-auto cursor-pointer"
              style={{
                gridColumn: `${unit.y + 1} / span ${cols}`,
                gridRow: `${unit.x + 1} / span ${rows}`,
              }}
              onClick={() => handleUnitClick(unit)}
            >
              <UnitRenderer
                unit={unit}
                isEnemy
                cellSize={CELL_SIZE}
              />
            </div>
          );
        })}
      </div>

      {/* ==================== PREVIEW GHOST (Deploy Mode) ==================== */}
      {previewPlacement && (
        <div
          className="absolute inset-1 pointer-events-none"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${mapSize}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${mapSize}, ${CELL_SIZE}px)`,
            gap: '1px',
          }}
        >
          {(() => {
            const def = UNIT_DEFINITIONS[previewPlacement.code];
            if (!def) return null;

            const cols = previewPlacement.vertical ? 1 : def.size;
            const rows = previewPlacement.vertical ? def.size : 1;

            // Build mock unit for preview
            const ghostCells = [];
            for (let i = 0; i < def.size; i++) {
              // Fixed: vertical means x increases, horizontal means y increases
              const cx = previewPlacement.vertical ? previewPlacement.x + i : previewPlacement.x;
              const cy = previewPlacement.vertical ? previewPlacement.y : previewPlacement.y + i;
              ghostCells.push({ x: cx, y: cy, hit: false });
            }

            const ghostUnit: Unit = {
              id: 'preview',
              code: previewPlacement.code,
              x: previewPlacement.x,
              y: previewPlacement.y,
              vertical: previewPlacement.vertical,
              hp: def.hp,
              maxHp: def.hp,
              isSunk: false,
              cells: ghostCells,
              type: def.type || 'SHIP',
              ownerId: '',
              isImmobilized: false,
            };

            return (
              <div
                style={{
                  gridColumn: `${previewPlacement.y + 1} / span ${cols}`,
                  gridRow: `${previewPlacement.x + 1} / span ${rows}`,
                }}
              >
                <UnitRenderer
                  unit={ghostUnit}
                  preview
                  isValid={previewPlacement.isValid}
                  cellSize={CELL_SIZE}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* ==================== EFFECT LAYER ==================== */}
      <AnimatePresence>
        {lastShotEffect && (
          <motion.div
            key={`shot-${lastShotEffect.x}-${lastShotEffect.y}`}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute pointer-events-none z-50"
            style={{
              left: lastShotEffect.y * (CELL_SIZE + 1) + CELL_SIZE / 2,
              top: lastShotEffect.x * (CELL_SIZE + 1) + CELL_SIZE / 2,
            }}
          >
            <div
              className={clsx(
                'w-8 h-8 rounded-full -translate-x-1/2 -translate-y-1/2',
                lastShotEffect.result === 'HIT' || lastShotEffect.result === 'SUNK'
                  ? 'bg-red-500'
                  : 'bg-blue-500'
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== COORDINATE LABELS ==================== */}
      {/* X-axis labels (top) */}
      <div
        className="absolute -top-5 left-1 flex"
        style={{ gap: '1px' }}
      >
        {Array.from({ length: mapSize }, (_, i) => (
          <div
            key={`x-${i}`}
            className="flex items-center justify-center text-[8px] text-slate-600 font-mono"
            style={{ width: CELL_SIZE }}
          >
            {i}
          </div>
        ))}
      </div>

      {/* Y-axis labels (left) */}
      <div
        className="absolute -left-5 top-1 flex flex-col"
        style={{ gap: '1px' }}
      >
        {Array.from({ length: mapSize }, (_, i) => (
          <div
            key={`y-${i}`}
            className="flex items-center justify-center text-[8px] text-slate-600 font-mono"
            style={{ height: CELL_SIZE }}
          >
            {i}
          </div>
        ))}
      </div>

      {/* ==================== HOVER TOOLTIP ==================== */}
      {hoverPos && hoverPos.x >= 0 && hoverPos.y >= 0 && (
        <div
          className="absolute bg-slate-800/90 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-cyan-400 z-50 pointer-events-none"
          style={{
            left: hoverPos.y * (CELL_SIZE + 1) + CELL_SIZE + 8,
            top: hoverPos.x * (CELL_SIZE + 1),
          }}
        >
          ({hoverPos.x}, {hoverPos.y})
        </div>
      )}
    </div>
  );
};
