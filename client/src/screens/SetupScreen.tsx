// client/src/screens/SetupScreen.tsx
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import { GameMap } from '../components/map/GameMap';
import { UNIT_DEFINITIONS, TERRAIN, getShips } from '../config/constants';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  Check,
  Ship,
  Building2,
  AlertTriangle,
  Anchor,
  MapPin,
  Trash2,
  Play,
  Package,
} from 'lucide-react';
import type { ShipPlacement, Unit } from '../types';

export const SetupScreen = () => {
  const { deployFleet, mapData, me, playerId, players } = useGameStore();

  // --- State ---
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [vertical, setVertical] = useState(false);
  const [placedUnits, setPlacedUnits] = useState<ShipPlacement[]>([]);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // --- Keyboard Shortcut for Rotation ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setVertical((v) => !v);
        toast(`Hướng: ${!vertical ? 'DỌC' : 'NGANG'}`, {
          duration: 1000,
          position: 'bottom-center',
        });
      }
      if (e.key === 'Escape') {
        setSelectedCode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vertical]);

  // --- Default Ships to Deploy ---
  const defaultShips = useMemo(() => {
    const ships = getShips();
    const defaults: Record<string, number> = {};
    ships.forEach((s) => {
      defaults[s.code] = 1;
    });
    return defaults;
  }, []);

  // --- Get inventory from me or players ---
  const myInventory = useMemo(() => {
    // Try me.inventory first, then fall back to players[playerId]
    if (me?.inventory && Object.keys(me.inventory).length > 0) {
      return me.inventory;
    }
    const myPlayerData = playerId ? players[playerId] : null;
    return myPlayerData?.inventory || {};
  }, [me?.inventory, players, playerId]);

  // --- Calculate remaining units to deploy ---
  const availableUnits = useMemo(() => {
    const counts: Record<string, number> = { ...defaultShips };

    // Add structures from inventory (using new object format)
    console.log('[SETUP] My inventory:', myInventory);
    for (const [itemCode, qty] of Object.entries(myInventory)) {
      const def = UNIT_DEFINITIONS[itemCode];
      if (def && def.type === 'STRUCTURE') {
        counts[itemCode] = (counts[itemCode] || 0) + qty;
      }
    }

    // Subtract already placed units
    placedUnits.forEach((u) => {
      if (counts[u.code] > 0) {
        counts[u.code]--;
      }
    });

    console.log('[SETUP] Available units:', counts);
    return counts;
  }, [myInventory, placedUnits, defaultShips]);

  // --- Total remaining count ---
  const remainingCount = useMemo(() => {
    return Object.values(availableUnits).reduce((a, b) => a + b, 0);
  }, [availableUnits]);

  const allDeployed = remainingCount === 0;

  // --- Validation ---
  const checkValidity = useCallback(
    (code: string, x: number, y: number, isVertical: boolean): boolean => {
      const def = UNIT_DEFINITIONS[code];
      if (!def || !mapData || mapData.length === 0) return false;

      const size = def.size;

      for (let i = 0; i < size; i++) {
        // vertical=true: ship extends DOWN (rows), x increases
        // vertical=false: ship extends RIGHT (columns), y increases
        const cx = isVertical ? x + i : x;
        const cy = isVertical ? y : y + i;

        if (cx < 0 || cy < 0 || cx >= mapData.length || cy >= mapData.length) {
          return false;
        }

        const terrain = mapData[cx]?.[cy];
        if (terrain !== TERRAIN.WATER) {
          return false;
        }

        const isOverlap = placedUnits.some((u) => {
          const uDef = UNIT_DEFINITIONS[u.code];
          if (!uDef) return false;
          for (let j = 0; j < uDef.size; j++) {
            // Same coordinate logic as above
            const ux = u.vertical ? u.x + j : u.x;
            const uy = u.vertical ? u.y : u.y + j;
            if (ux === cx && uy === cy) return true;
          }
          return false;
        });

        if (isOverlap) return false;
      }

      return true;
    },
    [mapData, placedUnits]
  );

  // --- Handlers ---
  const handleMapClick = (x: number, y: number) => {
    if (!selectedCode) {
      toast.error('Chọn đơn vị trước!', { icon: '👆' });
      return;
    }

    if ((availableUnits[selectedCode] || 0) <= 0) {
      toast.error('Đã hết đơn vị này!');
      setSelectedCode(null);
      return;
    }

    if (!checkValidity(selectedCode, x, y, vertical)) {
      toast.error('Vị trí không hợp lệ!', { icon: '❌' });
      return;
    }

    setPlacedUnits([...placedUnits, { code: selectedCode, x, y, vertical }]);
    toast.success(`Đã đặt ${UNIT_DEFINITIONS[selectedCode]?.name}`, {
      duration: 1000,
      position: 'bottom-center',
    });

    if ((availableUnits[selectedCode] || 0) <= 1) {
      setSelectedCode(null);
    }
  };

  const handleRemoveUnit = (index: number) => {
    const removed = placedUnits[index];
    setPlacedUnits(placedUnits.filter((_, i) => i !== index));
    toast(`Đã xóa ${UNIT_DEFINITIONS[removed.code]?.name}`, { icon: '🗑️' });
  };

  const handleReset = () => {
    setPlacedUnits([]);
    setSelectedCode(null);
    toast('Đã reset tất cả!', { icon: '🔄' });
  };

  const handleAutoDeploy = useCallback(() => {
    if (!mapData || mapData.length === 0) {
      toast.error('Bản đồ chưa sẵn sàng để tự động bố trí.');
      return;
    }

    const mapSize = mapData.length;
    const placed: ShipPlacement[] = [];
    const occupied = new Set<string>();
    const unitQueue: string[] = [];

    Object.entries(availableUnits).forEach(([code, qty]) => {
      for (let i = 0; i < qty; i++) {
        unitQueue.push(code);
      }
    });

    if (unitQueue.length === 0) {
      toast.error('Không có đơn vị để triển khai.', { icon: '⚠️' });
      return;
    }

    // Randomize order
    for (let i = unitQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [unitQueue[i], unitQueue[j]] = [unitQueue[j], unitQueue[i]];
    }

    const canPlace = (code: string, x: number, y: number, vertical: boolean) => {
      const def = UNIT_DEFINITIONS[code];
      if (!def) return false;
      for (let i = 0; i < def.size; i++) {
        const cx = vertical ? x + i : x;
        const cy = vertical ? y : y + i;
        if (cx < 0 || cy < 0 || cx >= mapSize || cy >= mapSize) return false;
        if (mapData[cx]?.[cy] !== TERRAIN.WATER) return false;
        if (occupied.has(`${cx},${cy}`)) return false;
      }
      return true;
    };

    const markCells = (code: string, x: number, y: number, vertical: boolean) => {
      const def = UNIT_DEFINITIONS[code];
      if (!def) return;
      for (let i = 0; i < def.size; i++) {
        const cx = vertical ? x + i : x;
        const cy = vertical ? y : y + i;
        occupied.add(`${cx},${cy}`);
      }
    };

    const tryPlace = (code: string) => {
      const maxTrials = mapSize * mapSize * 3;
      for (let attempt = 0; attempt < maxTrials; attempt++) {
        const x = Math.floor(Math.random() * mapSize);
        const y = Math.floor(Math.random() * mapSize);
        const vertical = Math.random() < 0.5;
        if (canPlace(code, x, y, vertical)) {
          markCells(code, x, y, vertical);
          placed.push({ code, x, y, vertical });
          return true;
        }
      }
      return false;
    };

    const leftovers: string[] = [];
    unitQueue.forEach((code) => {
      const placedSuccessfully = tryPlace(code);
      if (!placedSuccessfully && !leftovers.includes(code)) {
        leftovers.push(code);
      }
    });

    if (placed.length === 0) {
      toast.error('Không có vị trí khả dụng để tự động triển khai hạm đội.', { icon: '⚠️' });
      return;
    }

    setPlacedUnits(placed);
    setSelectedCode(null);

    if (leftovers.length > 0) {
      toast(`Đã đặt phần lớn hạm đội. Còn thiếu: ${leftovers.join(', ')}`, { icon: '⚠️' });
    } else {
      toast('🤖 Tự động bố trí hoàn tất!', { duration: 2000 });
    }
  }, [availableUnits, mapData]);

  const handleConfirm = () => {
    if (!allDeployed) {
      toast.error(`Còn ${remainingCount} đơn vị chưa triển khai!`);
      return;
    }

    // Validate that we own all structures we're trying to deploy
    const structureCounts: Record<string, number> = {};
    placedUnits.forEach(u => {
      const def = UNIT_DEFINITIONS[u.code];
      if (def?.type === 'STRUCTURE') {
        structureCounts[u.code] = (structureCounts[u.code] || 0) + 1;
      }
    });

    for (const [code, count] of Object.entries(structureCounts)) {
      const owned = myInventory[code] || 0;
      if (count > owned) {
        toast.error(`Bạn không sở hữu đủ ${UNIT_DEFINITIONS[code]?.name || code}! (Có: ${owned}, Cần: ${count})`);
        return;
      }
    }

    console.log('[SETUP] Deploying:', placedUnits);
    console.log('[SETUP] My inventory:', myInventory);
    
    deployFleet(placedUnits);
  };

  // --- Mock Data for Map ---
  const mockMe = useMemo(() => {
    if (!me) return null;

    const mockFleet: Unit[] = placedUnits.map((u, i) => {
      const def = UNIT_DEFINITIONS[u.code];
      if (!def) return null;

      return {
        id: `setup-${i}`,
        code: u.code,
        type: def.type,
        x: u.x,
        y: u.y,
        vertical: u.vertical,
        hp: def.hp,
        maxHp: def.hp,
        isSunk: false,
        isImmobilized: false,
        ownerId: playerId || '',
        vision: def.vision,
        cells: Array(def.size)
          .fill(0)
          .map((_, idx) => ({
            // vertical=true: extends down (rows), x increases
            // vertical=false: extends right (columns), y increases
            x: u.vertical ? u.x + idx : u.x,
            y: u.vertical ? u.y : u.y + idx,
            hit: false,
          })),
      };
    }).filter(Boolean) as Unit[];

    return { ...me, fleet: mockFleet };
  }, [me, placedUnits, playerId]);

  // --- Preview placement ---
  const previewPlacement = useMemo(() => {
    if (!selectedCode || !hoverPos || hoverPos.x < 0) return null;
    return {
      code: selectedCode,
      x: hoverPos.x,
      y: hoverPos.y,
      vertical,
      isValid: checkValidity(selectedCode, hoverPos.x, hoverPos.y, vertical),
    };
  }, [selectedCode, hoverPos, vertical, checkValidity]);

  // --- Other players status ---
  const otherPlayers = useMemo(() => {
    return Object.values(players).filter(p => p.id !== playerId);
  }, [players, playerId]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-80 bg-slate-900/80 backdrop-blur border-r border-slate-700/50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 flex items-center gap-2">
            <Anchor className="w-5 h-5 text-cyan-400" />
            TRIỂN KHAI HẠM ĐỘI
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Đặt các đơn vị vào vị trí chiến đấu
          </p>
        </div>

        {/* Ship/Structure List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Ship className="w-3 h-3" /> TÀU CHIẾN
          </h3>
          {Object.entries(availableUnits)
            .filter(([code]) => UNIT_DEFINITIONS[code]?.type === 'SHIP')
            .map(([code, count]) => {
              const def = UNIT_DEFINITIONS[code];
              if (!def || count <= 0) return null;

              return (
                <motion.button
                  key={code}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCode(code)}
                  className={clsx(
                    'w-full p-3 rounded-lg border transition-all text-left flex items-center justify-between',
                    selectedCode === code
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  )}
                >
                  <div>
                    <div className="font-bold">{def.name}</div>
                    <div className="text-xs text-slate-500">
                      Size: {def.size} | HP: {def.hp} | Vision: {def.vision}
                    </div>
                  </div>
                  <span className="text-2xl font-mono font-bold opacity-60">×{count}</span>
                </motion.button>
              );
            })}

          {/* Structures Section */}
          {Object.entries(availableUnits).some(
            ([code, count]) => UNIT_DEFINITIONS[code]?.type === 'STRUCTURE' && count > 0
          ) && (
            <>
              <h3 className="text-xs text-slate-500 uppercase tracking-wider mt-6 mb-2 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> CÔNG TRÌNH
              </h3>
              {Object.entries(availableUnits)
                .filter(([code]) => UNIT_DEFINITIONS[code]?.type === 'STRUCTURE')
                .map(([code, count]) => {
                  const def = UNIT_DEFINITIONS[code];
                  if (!def || count <= 0) return null;

                  return (
                    <motion.button
                      key={code}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedCode(code)}
                      className={clsx(
                        'w-full p-3 rounded-lg border transition-all text-left flex items-center justify-between',
                        selectedCode === code
                          ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      )}
                    >
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          {def.name}
                          {def.alwaysVisible && (
                            <span className="text-[8px] bg-yellow-500/30 text-yellow-400 px-1 rounded">
                              VISIBLE
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          Size: {def.size} | HP: {def.hp}
                        </div>
                      </div>
                      <span className="text-2xl font-mono font-bold opacity-60">×{count}</span>
                    </motion.button>
                  );
                })}
            </>
          )}

          {/* All Deployed Message */}
          <AnimatePresence>
            {allDeployed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-center"
              >
                <Check className="w-6 h-6 mx-auto mb-2" />
                <p className="font-bold">SẴN SÀNG CHIẾN ĐẤU!</p>
                <p className="text-xs opacity-70 mt-1">Nhấn START để bắt đầu</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-slate-700/50 space-y-3">
          <button
            onClick={() => setVertical(!vertical)}
            className={clsx(
              'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all',
              vertical
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
            )}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="font-mono">
              HƯỚNG: {vertical ? 'DỌC ↕' : 'NGANG ↔'} <span className="text-xs opacity-50">(R)</span>
            </span>
          </button>

          <div className="space-y-2">
            <button
              onClick={handleAutoDeploy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10 transition-all"
            >
              <MapPin className="w-4 h-4 text-cyan-400" />
              TỰ ĐỘNG TRIỂN KHAI
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                RESET
              </button>
              <button
                onClick={handleConfirm}
                disabled={!allDeployed}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all',
                  allDeployed
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-900 hover:from-cyan-400 hover:to-emerald-400'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                )}
              >
                <Play className="w-4 h-4" />
                START
              </button>
            </div>
          </div>

          {/* Other Players Status */}
          {otherPlayers.length > 0 && (
            <div className="text-center text-sm text-slate-500 pt-2 border-t border-slate-700/50">
              {otherPlayers.map(p => (
                <div key={p.id} className="flex items-center justify-center gap-2">
                  <span>{p.name}:</span>
                  <span className={p.ready ? 'text-emerald-400' : 'text-yellow-400'}>
                    {p.ready ? 'Đã triển khai' : 'Đang triển khai...'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 relative flex flex-col">
        <div className="bg-slate-900/80 backdrop-blur border-b border-slate-700/50 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm">
              {selectedCode ? (
                <span className="text-cyan-400">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Đang đặt: <strong>{UNIT_DEFINITIONS[selectedCode]?.name}</strong>{' '}
                  (Size: {UNIT_DEFINITIONS[selectedCode]?.size})
                </span>
              ) : (
                'Chọn đơn vị bên trái để bắt đầu'
              )}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-lg">
              <Package className="w-4 h-4 text-cyan-400" />
              <span className="font-mono">
                <span className={remainingCount === 0 ? 'text-emerald-400' : 'text-yellow-400'}>
                  {placedUnits.length}
                </span>
                <span className="text-slate-500">/{placedUnits.length + remainingCount}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
          <div className="transform scale-90">
            <GameMap
              interactive={true}
              me={mockMe}
              onCellClick={handleMapClick}
              onCellHover={(x, y) => setHoverPos({ x, y })}
              hoverMode={selectedCode ? 'deploy' : null}
              previewPlacement={previewPlacement}
            />
          </div>
        </div>

        {placedUnits.length > 0 && (
          <div className="bg-slate-900/80 backdrop-blur border-t border-slate-700/50 px-6 py-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-slate-500 shrink-0">Đã đặt:</span>
              {placedUnits.map((u, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs shrink-0"
                >
                  <span>{UNIT_DEFINITIONS[u.code]?.name}</span>
                  <span className="text-slate-500">
                    ({u.x},{u.y})
                  </span>
                  <button
                    onClick={() => handleRemoveUnit(idx)}
                    className="text-red-400 hover:text-red-300 ml-1"
                  >
                    ×
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {previewPlacement && !previewPlacement.isValid && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"
            >
              <AlertTriangle className="w-5 h-5" />
              Vị trí không hợp lệ (Đảo/Đá ngầm hoặc trùng lặp)
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
