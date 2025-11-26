// client/src/screens/BattleScreen.tsx
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useGameStore, useIsMyTurn } from '../store/useGameStore';
import { GameMap } from '../components/map/GameMap';
import {
  UNIT_DEFINITIONS,
  ITEMS,
  TERRAIN,
  CONSTANTS,
  getItemName,
} from '../config/constants';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Navigation,
  Package,
  Zap,
  AlertTriangle,
  X,
  Crosshair,
  Skull,
  Eye,
  Radio,
  Clock,
  Heart,
  ShoppingCart,
  Map as MapIcon,
  Shield,
} from 'lucide-react';
import type { Unit, ItemUseParams, InventoryObject } from '../types';

type BattleMode =
  | 'SELECT'
  | 'MOVE'
  | 'ATTACK'
  | 'ITEM'
  | 'ENGINE_BOOST_SELECT_UNIT'
  | 'ENGINE_BOOST_SELECT_DEST'
  | 'MERCENARY_SELECT'
  | 'BLACK_HAT_SOURCE'
  | 'BLACK_HAT_TARGET'
  | 'WHITE_HAT_PLACE'
  | 'RADAR_SELECT_UNIT'
  | 'JAMMER_SELECT_UNIT'
  | 'REPAIR_SELECT'
  | 'DEPLOY_STRUCTURE';

interface ItemModalData {
  itemId: string;
  requiresTarget:
    | 'unit'
    | 'enemy_unit'
    | 'enemy_structure'
    | 'cell'
    | 'row_col'
    | 'none'
    | 'black_hat_source'
    | 'black_hat_target'
    | 'white_hat_cell'
    | 'radar_unit'
    | 'jammer_unit';
}

export const BattleScreen = () => {
  const {
    me,
    opponent,
    playerId,
    moveUnit,
    fireShot,
    activateSkill,
    useItem,
    buyItem,
    mapData,
    logs,
    shotMarkers,
    droneMarkers,
  } = useGameStore();

  const isMyTurn = useIsMyTurn();

  const [mode, setMode] = useState<BattleMode>('SELECT');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ItemModalData | null>(null);
  const [droneAxis, setDroneAxis] = useState<'row' | 'col'>('row');
  const [droneIndex, setDroneIndex] = useState<number>(0);
  const [showShop, setShowShop] = useState(false);
  const [engineBoostUnitId, setEngineBoostUnitId] = useState<string | null>(null);
  const [engineBoostRotate, setEngineBoostRotate] = useState(false);
  const [hoverCell, setHoverCell] = useState<{x: number, y: number} | null>(null);
  const [deployingStructure, setDeployingStructure] = useState<string | null>(null);
  const [blackHatCarrier, setBlackHatCarrier] = useState<string | null>(null);
  const [structureOrientation, setStructureOrientation] = useState(false);

  // Filter out null opponent units (fog of war)
  const visibleOpponentFleet = useMemo(() => {
    if (!opponent?.fleet) return [];
    return opponent.fleet.filter((u): u is Unit => u !== null && u !== undefined);
  }, [opponent?.fleet]);

  const selectedUnit = useMemo(
    () => me?.fleet.find((u) => u.id === selectedUnitId),
    [me?.fleet, selectedUnitId]
  );

  const selectedUnitDef = useMemo(
    () => (selectedUnit ? UNIT_DEFINITIONS[selectedUnit.code] : undefined),
    [selectedUnit]
  );

  const isCritical = useMemo(() => {
    if (!selectedUnit) return false;
    return selectedUnit.hp < selectedUnit.maxHp * CONSTANTS.CRITICAL_THRESHOLD;
  }, [selectedUnit]);

  const hasActiveSilo = useMemo(() => {
    return me?.fleet.some(
      (u) => u.code === 'SILO' && !u.isSunk && (u.chargingTurns || 0) <= 0
    );
  }, [me?.fleet]);

  // --- Inventory as object ---
  const inventory: InventoryObject = me?.inventory || {};

  // --- Valid Moves (Axis-only: vertical ships move vertically, horizontal move horizontally) ---
  const validMoves = useMemo(() => {
    if (mode !== 'MOVE' || !selectedUnit || selectedUnit.isImmobilized) return [];

    const def = UNIT_DEFINITIONS[selectedUnit.code];
    const range = def?.move || 0;
    const moves: string[] = [];

    if (range === 0 || !mapData || mapData.length === 0) return [];
    const mapSize = mapData.length;

    // Axis-only movement: vertical ships can only change X, horizontal only change Y
    for (let delta = -range; delta <= range; delta++) {
      if (delta === 0) continue;
      
      let newX = selectedUnit.x;
      let newY = selectedUnit.y;
      
      if (selectedUnit.vertical) {
        // Vertical ship - move along X axis (up/down)
        newX = selectedUnit.x + delta;
      } else {
        // Horizontal ship - move along Y axis (left/right)
        newY = selectedUnit.y + delta;
      }
      
      // Validate all cells of the ship at new position
      let valid = true;
      for (let i = 0; i < def.size; i++) {
        const cx = selectedUnit.vertical ? newX + i : newX;
        const cy = selectedUnit.vertical ? newY : newY + i;
        
        if (cx < 0 || cy < 0 || cx >= mapSize || cy >= mapSize) {
          valid = false;
          break;
        }
        
        const terrain = mapData[cx][cy];
        if (terrain === TERRAIN.ISLAND) {
          valid = false;
          break;
        }
        if (terrain === TERRAIN.REEF && (def.size >= 4 || selectedUnit.code === 'SS')) {
          valid = false;
          break;
        }
        
        // Check collision with own fleet
        const occupied = me?.fleet.some(
          (u) => !u.isSunk && u.id !== selectedUnit.id && u.cells?.some((c) => c.x === cx && c.y === cy)
        );
        if (occupied) {
          valid = false;
          break;
        }
      }
      
      if (valid) {
        moves.push(`${newX},${newY}`);
      }
    }

    return moves;
  }, [mode, selectedUnit, mapData, me?.fleet]);

  // --- Engine Boost Valid Moves ---
  const engineBoostMoves = useMemo(() => {
    if (mode !== 'ENGINE_BOOST_SELECT_DEST' || !engineBoostUnitId) return [];
    
    const unit = me?.fleet.find(u => u.id === engineBoostUnitId);
    if (!unit || !mapData) return [];

    const moves: string[] = [];
    const maxRange = 5;

    for (let x = 0; x < mapData.length; x++) {
      for (let y = 0; y < mapData.length; y++) {
        const dist = Math.abs(x - unit.x) + Math.abs(y - unit.y);
        if (dist <= maxRange && dist > 0) {
          const terrain = mapData[x][y];
          if (terrain === TERRAIN.ISLAND) continue;
          moves.push(`${x},${y}`);
        }
      }
    }

    return moves;
  }, [mode, engineBoostUnitId, me?.fleet, mapData]);

  // --- Handlers ---
  const handleMapClick = useCallback(
    (x: number, y: number) => {
      if (!isMyTurn) return;

      // SELECT mode - try to select own unit
      if (mode === 'SELECT') {
        const clickedUnit = me?.fleet.find((u) =>
          !u.isSunk && (
            (u.x === x && u.y === y) ||
            u.cells?.some((c) => c.x === x && c.y === y)
          )
        );
        if (clickedUnit) {
          setSelectedUnitId(clickedUnit.id);
          return;
        }
        // Deselect if clicking empty cell
        setSelectedUnitId(null);
        return;
      }

      // BLACK_HAT: select carrier ship first
      if (mode === 'BLACK_HAT_SOURCE') {
        const carrier = me?.fleet.find((u) =>
          !u.isSunk &&
          u.type === 'SHIP' &&
          ((u.x === x && u.y === y) || u.cells?.some((c) => c.x === x && c.y === y))
        );
        if (carrier) {
          setBlackHatCarrier(carrier.id);
          setMode('BLACK_HAT_TARGET');
          toast.success('Chọn công trình địch để hack!', { icon: '💻' });
        } else {
          toast.error('Chọn một tàu của bạn để trang bị Hacker.');
        }
        return;
      }

      // BLACK_HAT: select enemy target after carrier
      if (mode === 'BLACK_HAT_TARGET' && blackHatCarrier) {
        const enemyStruct = visibleOpponentFleet.find((u) =>
          !u.isSunk &&
          u.type === 'STRUCTURE' &&
          ((u.x === x && u.y === y) || u.cells?.some((c) => c.x === x && c.y === y))
        );
        if (enemyStruct) {
          handleItemUseWithParams('BLACK_HAT', { hackerId: blackHatCarrier, targetId: enemyStruct.id });
          setBlackHatCarrier(null);
        } else {
          toast.error('Chọn một công trình địch lộ diện để Hack.');
        }
        return;
      }

      // WHITE_HAT: place on map
      if (mode === 'WHITE_HAT_PLACE') {
        const terrain = mapData?.[x]?.[y];
        if (terrain === TERRAIN.ISLAND) {
          toast.error('Không thể đặt White Hat lên đảo!');
          return;
        }
        handleItemUseWithParams('WHITE_HAT', { x, y });
        return;
      }

      // RADAR: select own unit to install
      if (mode === 'RADAR_SELECT_UNIT') {
        const ownUnit = me?.fleet.find((u) =>
          !u.isSunk &&
          ((u.x === x && u.y === y) || u.cells?.some((c) => c.x === x && c.y === y))
        );
        if (ownUnit) {
          handleItemUseWithParams('RADAR', { unitId: ownUnit.id });
        } else {
          toast.error('Chọn tàu hoặc công trình của bạn để gắn radar.');
        }
        return;
      }

      // JAMMER: select own unit to deploy jammer
      if (mode === 'JAMMER_SELECT_UNIT') {
        const ownUnit = me?.fleet.find((u) =>
          !u.isSunk &&
          ((u.x === x && u.y === y) || u.cells?.some((c) => c.x === x && c.y === y))
        );
        if (ownUnit) {
          handleItemUseWithParams('JAMMER', { unitId: ownUnit.id });
        } else {
          toast.error('Chọn tàu hoặc công trình của bạn để kích hoạt phá sóng.');
        }
        return;
      }

      // MOVE mode
      if (mode === 'MOVE' && selectedUnitId) {
        if (validMoves.includes(`${x},${y}`)) {
          moveUnit(selectedUnitId, x, y);
          setMode('SELECT');
          setSelectedUnitId(null);
        } else {
          toast.error('Vị trí không hợp lệ!', { icon: '❌' });
        }
        return;
      }

      // ATTACK mode
      if (mode === 'ATTACK' && selectedUnitId) {
        if (selectedUnit?.code === 'DD') {
          const terrain = mapData[x]?.[y];
          if (terrain === TERRAIN.ISLAND) {
            toast('Cảnh báo: Đảo có thể chặn đạn bắn thẳng!', { icon: '⛰️' });
          }
        }
        fireShot(x, y, selectedUnitId);
        setMode('SELECT');
        setSelectedUnitId(null);
        return;
      }

      // ENGINE_BOOST_SELECT_UNIT - select a unit to boost
      if (mode === 'ENGINE_BOOST_SELECT_UNIT') {
        const clickedUnit = me?.fleet.find((u) =>
          !u.isSunk && u.type === 'SHIP' && (
            (u.x === x && u.y === y) ||
            u.cells?.some((c) => c.x === x && c.y === y)
          )
        );
        if (clickedUnit) {
          setEngineBoostUnitId(clickedUnit.id);
          setMode('ENGINE_BOOST_SELECT_DEST');
          toast.success(`Đã chọn ${UNIT_DEFINITIONS[clickedUnit.code]?.name}. Chọn vị trí đích!`, { icon: '🚀' });
        } else {
          toast.error('Chọn một tàu để tăng tốc!');
        }
        return;
      }

      // ENGINE_BOOST_SELECT_DEST - select destination
      if (mode === 'ENGINE_BOOST_SELECT_DEST' && engineBoostUnitId) {
        if (engineBoostMoves.includes(`${x},${y}`)) {
          handleItemUseWithParams('ENGINE_BOOST', { 
            unitId: engineBoostUnitId, 
            x, 
            y,
            rotate: engineBoostRotate 
          });
          setMode('SELECT');
          setEngineBoostUnitId(null);
          setEngineBoostRotate(false);
        } else {
          toast.error('Vị trí ngoài tầm (tối đa 5 ô)!');
        }
        return;
      }

      // DEPLOY_STRUCTURE - đặt công trình trong trận
      if (mode === 'DEPLOY_STRUCTURE' && deployingStructure) {
        // TODO: Add server emit for deploy_structure
        const socket = useGameStore.getState().socket;
        const roomId = useGameStore.getState().roomId;
        if (socket && roomId) {
          socket.emit('deploy_structure', { 
            roomId, 
            structureCode: deployingStructure, 
            x, 
            y, 
            vertical: structureOrientation 
          });
        }
        setMode('SELECT');
        setDeployingStructure(null);
        setStructureOrientation(false);
        return;
      }

      // REPAIR_SELECT - select own unit to repair
      if (mode === 'REPAIR_SELECT') {
        const clickedUnit = me?.fleet.find((u) =>
          !u.isSunk && (
            (u.x === x && u.y === y) ||
            u.cells?.some((c) => c.x === x && c.y === y)
          )
        );
        if (clickedUnit && clickedUnit.hp < clickedUnit.maxHp) {
          handleItemUseWithParams('REPAIR_KIT', { targetId: clickedUnit.id });
          setMode('SELECT');
        } else if (clickedUnit) {
          toast.error('Đơn vị này đã đầy máu!');
        } else {
          toast.error('Chọn một đơn vị của bạn!');
        }
        return;
      }

      // MERCENARY_SELECT - select enemy unit
      if (mode === 'MERCENARY_SELECT') {
        const enemyUnit = visibleOpponentFleet.find((u) =>
          !u.isSunk && (
            (u.x === x && u.y === y) ||
            u.cells?.some((c) => c.x === x && c.y === y)
          )
        );
        if (enemyUnit) {
          handleItemUseWithParams('MERCENARY', { targetId: enemyUnit.id });
          setMode('SELECT');
        } else {
          toast.error('Chọn một tàu địch đã lộ!');
        }
        return;
      }

      // ITEM mode for cell-target items (DECOY, SUICIDE_SQUAD, NUKE)
      if (mode === 'ITEM' && selectedItem) {
        if (selectedItem.requiresTarget === 'cell') {
          handleItemUseWithParams(selectedItem.itemId, { x, y, vertical: false });
          setSelectedItem(null);
          setMode('SELECT');
        }
        return;
      }
    },
    [isMyTurn, mode, selectedUnitId, validMoves, me?.fleet, selectedItem, selectedUnit, mapData, visibleOpponentFleet, engineBoostUnitId, engineBoostMoves, blackHatCarrier]
  );

  const handleItemUseWithParams = (itemId: string, params: ItemUseParams) => {
    try {
      useItem(itemId, params);
      setSelectedItem(null);
      setMode('SELECT');
      setSelectedUnitId(null);
    } catch (error: any) {
      toast.error(error.message || 'Lỗi sử dụng vật phẩm!');
    }
  };

  const handleSelfDestruct = () => {
    if (!selectedUnitId) return;
    if (!window.confirm('⚠️ CẢNH BÁO: TỰ HỦY?\n\nĐơn vị sẽ bị phá hủy và gây 5 DMG trong 3x3!')) return;

    try {
      useItem('SELF_DESTRUCT', { unitId: selectedUnitId });
      setMode('SELECT');
      setSelectedUnitId(null);
    } catch (error: any) {
      toast.error(error.message || 'Lỗi tự hủy!');
    }
  };

  const handleSelectItem = (itemId: string) => {
    const itemDef = ITEMS[itemId];
    if (!itemDef) return;

    // Special handling for specific items
    switch (itemId) {
      case 'REPAIR_KIT':
        setSelectedItem({ itemId, requiresTarget: 'unit' });
        setMode('REPAIR_SELECT');
        toast('Chọn đơn vị cần sửa chữa trên bản đồ!', { icon: '🔧' });
        return;

      case 'ENGINE_BOOST':
        setSelectedItem({ itemId, requiresTarget: 'unit' });
        setMode('ENGINE_BOOST_SELECT_UNIT');
        toast('Chọn tàu cần tăng tốc trên bản đồ!', { icon: '🚀' });
        return;

      case 'MERCENARY':
        setSelectedItem({ itemId, requiresTarget: 'enemy_unit' });
        setMode('MERCENARY_SELECT');
        toast('Chọn tàu địch đã lộ trên bản đồ!', { icon: '🎯' });
        return;

      case 'BLACK_HAT':
        setSelectedItem({ itemId, requiresTarget: 'black_hat_source' });
        setMode('BLACK_HAT_SOURCE');
        toast('Chọn tàu của bạn để trang bị Hacker!', { icon: '💻' });
        return;

      case 'WHITE_HAT':
        setSelectedItem({ itemId, requiresTarget: 'white_hat_cell' });
        setMode('WHITE_HAT_PLACE');
        toast('Chọn tọa độ để đặt White Hat!', { icon: '🛡️' });
        return;

      case 'RADAR':
        setSelectedItem({ itemId, requiresTarget: 'radar_unit' });
        setMode('RADAR_SELECT_UNIT');
        toast('Chọn tàu/công trình để gắn Radar!', { icon: '📡' });
        return;

      case 'JAMMER':
        setSelectedItem({ itemId, requiresTarget: 'jammer_unit' });
        setMode('JAMMER_SELECT_UNIT');
        toast('Chọn tàu/công trình để kích hoạt Jammer!', { icon: '📻' });
        return;

      case 'DRONE':
        setSelectedItem({ itemId, requiresTarget: 'row_col' });
        setMode('ITEM');
        return;

      case 'DECOY':
      case 'SUICIDE_SQUAD':
        setSelectedItem({ itemId, requiresTarget: 'cell' });
        setMode('ITEM');
        toast('Chọn vị trí trên bản đồ!', { icon: '🎯' });
        return;

      case 'NUKE':
        if (!hasActiveSilo) {
          toast.error('Cần SILO đã nạp đạn!');
          return;
        }
        setSelectedItem({ itemId, requiresTarget: 'cell' });
        setMode('ITEM');
        toast('⚠️ CHỌN MỤC TIÊU HẠT NHÂN!', { 
          icon: '☢️',
          style: { background: '#ef4444', color: 'white' }
        });
        return;

      default:
        toast.error('Vật phẩm không xác định!');
    }
  };

  const cancelAction = useCallback(() => {
    setMode('SELECT');
    setSelectedUnitId(null);
    setSelectedItem(null);
    setEngineBoostUnitId(null);
    setEngineBoostRotate(false);
    setDeployingStructure(null);
    setStructureOrientation(false);
    setBlackHatCarrier(null);
  }, []);

  // ESC key to cancel any action
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelAction();
      }
      if ((e.key === 'r' || e.key === 'R') && mode === 'DEPLOY_STRUCTURE') {
        setStructureOrientation((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, cancelAction]);

  // Shop items available during battle (items + structures)
  const shopItems = useMemo(() => {
    const items = Object.entries(ITEMS).filter(([id, item]) =>
      (item.type === 'ACTIVE' || item.type === 'PASSIVE') && id !== 'NUKE'
    );
    // Add structures that can be bought
    const structures = Object.entries(UNIT_DEFINITIONS).filter(([_, def]) => 
      def.type === 'STRUCTURE' && def.cost > 0
    ).map(([code, def]) => [code, { ...def, id: code, type: 'STRUCTURE' as const }]);
    
    return [...items, ...structures] as [string, any][];
  }, []);

  // Get structures in inventory that can be deployed
  const handleDeployStructure = (structureCode: string) => {
    setDeployingStructure(structureCode);
    setMode('DEPLOY_STRUCTURE');
    setStructureOrientation(false);
    toast('Chọn vị trí đặt công trình trên bản đồ!', { icon: '🏗️' });
  };

  const handleBuyItem = (itemId: string) => {
    try {
      buyItem(itemId);
    } catch (error: any) {
      toast.error(error.message || 'Không thể mua vật phẩm!');
    }
  };

  // Format log entry
  const formatLog = (log: any) => {
    const isMyAction = log.attacker === playerId || log.playerId === playerId;
    
    if (log.action === 'ITEM') {
      const itemName = getItemName(log.itemId);
      return {
        text: `${isMyAction ? 'Bạn' : 'Địch'} sử dụng ${itemName}`,
        type: log.result?.type || 'info',
        isEnemy: !isMyAction,
      };
    }

    if (log.action === 'BUY') {
      const itemName = getItemName(log.itemId);
      return {
        text: `${isMyAction ? 'Bạn' : 'Địch'} mua ${itemName}`,
        type: 'info',
        isEnemy: !isMyAction,
      };
    }

    if (log.action === 'SELL') {
      const itemName = getItemName(log.itemId);
      return {
        text: `${isMyAction ? 'Bạn' : 'Địch'} bán ${itemName}`,
        type: 'info',
        isEnemy: !isMyAction,
      };
    }

    if (log.action === 'PASSIVE_GENERATE') {
      const itemName = getItemName(log.item);
      return {
        text: `${isMyAction ? 'Bạn' : 'Địch'} nhận được ${itemName}`,
        type: 'info',
        isEnemy: !isMyAction,
      };
    }

    if (log.action === 'ASSASSINATION') {
      return {
        text: `Sát thủ hoàn thành nhiệm vụ!`,
        type: 'kill',
        isEnemy: !isMyAction,
      };
    }

    // Attack logs
    if (log.unit) {
      const unitName = UNIT_DEFINITIONS[log.unit]?.name || log.unit;
      const result = log.result === 'HIT' ? 'TRÚNG' : 
                    log.result === 'SUNK' ? 'TIÊU DIỆT' :
                    log.result === 'MISS' ? 'TRƯỢT' : log.result;
      const sunkInfo = log.sunk?.length ? ` (${log.sunk.join(', ')})` : '';
      
      return {
        text: `[${unitName}] → (${log.x},${log.y}) = ${result}${sunkInfo}`,
        type: log.result,
        isEnemy: !isMyAction,
      };
    }

    return {
      text: JSON.stringify(log),
      type: 'info',
      isEnemy: false,
    };
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-slate-900/90 backdrop-blur border-b border-slate-700/50 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
            TRUNG TÂM CHỈ HUY
          </h1>
          <div
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold border',
              isMyTurn
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 animate-pulse'
                : 'bg-red-500/20 border-red-500/50 text-red-400'
            )}
          >
            <Radio className="w-4 h-4" />
            {isMyTurn ? 'LƯỢT CỦA BẠN' : 'CHỜ ĐỐI THỦ'}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Shop Toggle */}
          <button
            onClick={() => setShowShop(!showShop)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all',
              showShop 
                ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                : 'bg-slate-800/80 border-slate-700 hover:border-yellow-500/50 text-slate-400'
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            <span className="font-bold">SHOP</span>
          </button>

          <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-lg">
            <span className="text-yellow-400 text-xl font-bold font-mono">
              ${me?.points || 0}
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 block">ĐỐI THỦ</span>
            <span className="text-red-400 font-bold">{opponent?.name || 'Unknown'}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Shop Panel (conditional) */}
        <AnimatePresence>
          {showShop && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-slate-900/95 border-r border-slate-700/50 overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-700/50">
                <h3 className="font-bold text-yellow-400 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  CỬA HÀNG CHIẾN TRƯỜNG
                </h3>
                <p className="text-xs text-slate-500 mt-1">Mua vật phẩm hỗ trợ</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {shopItems.map(([itemId, item]) => {
                  const canAfford = (me?.points || 0) >= item.cost;
                  const hasSpace = (me?.usedSlots || 0) < (me?.maxSlots || CONSTANTS.MAX_SLOTS);
                  const currentQty = inventory[itemId] || 0;

                  return (
                    <motion.div
                      key={itemId}
                      whileHover={{ scale: 1.02 }}
                      className={clsx(
                        'p-3 rounded-lg border transition-all',
                        canAfford && hasSpace
                          ? 'border-slate-700 hover:border-yellow-500/50 cursor-pointer'
                          : 'border-slate-800 opacity-50 cursor-not-allowed'
                      )}
                      onClick={() => canAfford && hasSpace && handleBuyItem(itemId)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-sm flex items-center gap-2">
                            {item.name}
                            {currentQty > 0 && (
                              <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 rounded">
                                x{currentQty}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {item.type === 'PASSIVE' ? '🛡️ Tự động' : '⚡ Chủ động'}
                          </div>
                        </div>
                        <span className={clsx(
                          'font-bold font-mono text-sm',
                          canAfford ? 'text-yellow-400' : 'text-red-400'
                        )}>
                          ${item.cost}
                        </span>
                      </div>
                      {item.desc && (
                        <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{item.desc}</p>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-slate-700/50 bg-slate-950/50">
                <div className="text-xs text-slate-500">
                  Slots: {me?.usedSlots || 0}/{me?.maxSlots || CONSTANTS.MAX_SLOTS}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Map Area */}
        <div className="flex-1 relative flex items-center justify-center p-4 overflow-auto">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzNDE1NSIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />

          <GameMap
            interactive={isMyTurn}
            onCellClick={handleMapClick}
            onCellHover={(x, y) => setHoverCell(x >= 0 ? {x, y} : null)}
            hoverMode={
              mode === 'ATTACK'
                ? 'attack'
                : mode === 'MOVE'
                ? 'move'
                : mode === 'ITEM' || mode.includes('SELECT')
                ? 'item'
                : null
            }
            validMoves={mode === 'ENGINE_BOOST_SELECT_DEST' ? engineBoostMoves : validMoves}
            selectedUnitId={selectedUnitId || engineBoostUnitId}
            dronePreview={selectedItem?.itemId === 'DRONE' ? { axis: droneAxis, index: droneIndex } : undefined}
            shotMarkers={shotMarkers}
            droneMarkers={droneMarkers}
          />

          {/* Overlay Legend */}
          <div className="absolute bottom-4 left-4 flex gap-3 text-[10px] text-slate-300 bg-slate-900/80 border border-slate-800 rounded-full px-3 py-1">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500/80 border border-red-300/70" />
              <span>Vị trí đã bắn (10 lượt)</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[12px]">⚓</span>
              <span>Drone tô màu mục tiêu</span>
            </div>
          </div>

          {/* Unit Action Panel */}
          <AnimatePresence>
          {selectedUnit && isMyTurn && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="absolute bottom-8 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 z-30"
              >
                <div className="p-4 flex items-center gap-6">
                  <div className="border-r border-slate-700 pr-6">
                    <div className="text-2xl font-bold text-cyan-400 font-mono mb-1">
                      {selectedUnit.code}
                    </div>
                    <div className="text-sm text-slate-400 font-mono">
                      {UNIT_DEFINITIONS[selectedUnit.code]?.name}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Heart className="w-4 h-4 text-red-400" />
                      <span className={clsx(
                        'font-mono font-bold',
                        isCritical ? 'text-red-400' : 'text-emerald-400'
                      )}>
                        {selectedUnit.hp}/{selectedUnit.maxHp}
                      </span>
                    </div>
                    {selectedUnit.isImmobilized && (
                      <div className="text-xs text-red-400 font-bold mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> ĐỘNG CƠ HỎNG
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    {selectedUnit.type !== 'STRUCTURE' && (
                      <button
                        onClick={() => setMode('MOVE')}
                        disabled={selectedUnit.isImmobilized}
                        className={clsx(
                          'flex flex-col items-center gap-1 px-6 py-3 rounded-xl border transition-all',
                          mode === 'MOVE'
                            ? 'bg-cyan-500 text-slate-900 border-cyan-500'
                            : 'border-slate-600 hover:border-cyan-500 text-slate-300 hover:text-white',
                          selectedUnit.isImmobilized && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <Navigation className="w-5 h-5" />
                        <span className="text-xs font-bold">DI CHUYỂN</span>
                      </button>
                    )}

                    {selectedUnit.type !== 'STRUCTURE' && (
                      <button
                        onClick={() => setMode('ATTACK')}
                        className={clsx(
                          'flex flex-col items-center gap-1 px-6 py-3 rounded-xl border transition-all',
                          mode === 'ATTACK'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'border-slate-600 hover:border-red-500 text-slate-300 hover:text-white'
                        )}
                      >
                        <Crosshair className="w-5 h-5" />
                        <span className="text-xs font-bold">TẤN CÔNG</span>
                      </button>
                    )}

                    {isCritical && selectedUnit.type !== 'STRUCTURE' && (
                      <button
                        onClick={handleSelfDestruct}
                        className="flex flex-col items-center gap-1 px-6 py-3 rounded-xl border border-red-600 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white transition-all animate-pulse"
                      >
                        <Skull className="w-5 h-5" />
                        <span className="text-xs font-bold">TỰ HỦY</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={cancelAction}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
                    <div>
                      <span className="text-slate-500">Vision:</span>{' '}
                      <span className="text-white">{selectedUnitDef?.vision ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Move:</span>{' '}
                      <span className="text-white">{selectedUnitDef?.move ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Cells:</span>{' '}
                      <span className="text-white">{selectedUnit.cells?.length ?? selectedUnitDef?.size ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Loại:</span>{' '}
                      <span className="text-white">{selectedUnit.type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Vị trí:</span>{' '}
                      <span className="text-white">({selectedUnit.x},{selectedUnit.y})</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Trạng thái:</span>{' '}
                      <span className="text-white">
                        {selectedUnit.isImmobilized ? 'Động cơ hỏng' : isCritical ? 'Critical' : 'Sẵn sàng'}
                      </span>
                    </div>
                  </div>
                  {selectedUnitDef?.desc && (
                    <p className="mt-2 text-[10px] italic text-slate-500">
                      {selectedUnitDef.desc}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode Indicator */}
          {mode !== 'SELECT' && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur px-6 py-3 rounded-xl border border-slate-700 flex items-center gap-3 z-30"
            >
              {mode === 'MOVE' && (
                <>
                  <Navigation className="w-5 h-5 text-cyan-400" />
                  <span>Chọn vị trí di chuyển</span>
                </>
              )}
              {mode === 'ATTACK' && (
                <>
                  <Target className="w-5 h-5 text-red-400" />
                  <span>Chọn mục tiêu tấn công</span>
                </>
              )}
              {mode === 'ENGINE_BOOST_SELECT_UNIT' && (
                <>
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span>Chọn tàu để tăng tốc</span>
                </>
              )}
              {mode === 'ENGINE_BOOST_SELECT_DEST' && (
                <>
                  <MapIcon className="w-5 h-5 text-yellow-400" />
                  <span>Chọn vị trí đích (tối đa 5 ô)</span>
                  <button
                    onClick={() => setEngineBoostRotate(!engineBoostRotate)}
                    className={clsx(
                      'ml-2 px-2 py-1 rounded text-xs font-bold border transition-all',
                      engineBoostRotate 
                        ? 'bg-yellow-500 text-slate-900 border-yellow-500'
                        : 'border-slate-600 text-slate-400 hover:border-yellow-500'
                    )}
                  >
                    🔄 XOAY: {engineBoostRotate ? 'BẬT' : 'TẮT'}
                  </button>
                </>
              )}
              {mode === 'REPAIR_SELECT' && (
                <>
                  <Heart className="w-5 h-5 text-emerald-400" />
                  <span>Chọn đơn vị cần sửa chữa</span>
                </>
              )}
              {mode === 'MERCENARY_SELECT' && (
                <>
                  <Skull className="w-5 h-5 text-purple-400" />
                  <span>Chọn tàu địch làm mục tiêu</span>
                </>
              )}
              {mode === 'BLACK_HAT_SOURCE' && (
                <>
                  <Zap className="w-5 h-5 text-purple-400" />
                  <span>Chọn tàu của bạn để gắn Hacker</span>
                </>
              )}
              {mode === 'BLACK_HAT_TARGET' && (
                <>
                  <Zap className="w-5 h-5 text-red-400" />
                  <span>Chọn công trình địch để hack</span>
                </>
              )}
              {mode === 'WHITE_HAT_PLACE' && (
                <>
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <span>Chọn ô để đặt White Hat</span>
                </>
              )}
              {mode === 'RADAR_SELECT_UNIT' && (
                <>
                  <Radio className="w-5 h-5 text-indigo-400" />
                  <span>Chọn tàu/công trình để gắn Radar</span>
                </>
              )}
              {mode === 'JAMMER_SELECT_UNIT' && (
                <>
                  <Zap className="w-5 h-5 text-sky-400" />
                  <span>Chọn tàu/công trình để kích hoạt Jammer</span>
                </>
              )}
              {mode === 'ITEM' && selectedItem?.requiresTarget === 'cell' && (
                <>
                  <Package className="w-5 h-5 text-yellow-400" />
                  <span>Chọn vị trí cho {getItemName(selectedItem.itemId)}</span>
                </>
              )}
              {mode === 'DEPLOY_STRUCTURE' && deployingStructure && (
                <>
                  <Package className="w-5 h-5 text-purple-400" />
                  <span>Đặt {UNIT_DEFINITIONS[deployingStructure]?.name || deployingStructure}</span>
                  <button
                    onClick={() => setStructureOrientation((prev) => !prev)}
                    className={clsx(
                      'ml-2 px-2 py-1 rounded text-xs font-bold border transition-all',
                      structureOrientation
                        ? 'bg-amber-500 text-slate-900 border-amber-500'
                        : 'border-slate-600 text-slate-400 hover:border-amber-500'
                    )}
                  >
                    🔄 XOAY: {structureOrientation ? 'DỌC' : 'NGANG'}
                  </button>
                </>
              )}
              {mode === 'DEPLOY_STRUCTURE' && deployingStructure && (
                <>
                  <Package className="w-5 h-5 text-purple-400" />
                  <span>Chọn vị trí đặt {UNIT_DEFINITIONS[deployingStructure]?.name || deployingStructure}</span>
                </>
              )}
              <button 
                onClick={cancelAction} 
                className="text-slate-400 hover:text-white ml-2 flex items-center gap-1 px-2 py-1 rounded border border-slate-600 hover:border-red-500"
              >
                <X className="w-4 h-4" />
                <span className="text-xs">HỦY (ESC)</span>
              </button>
            </motion.div>
          )}

          {/* Hover Info */}
          {hoverCell && (
            <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur px-3 py-2 rounded-lg text-xs font-mono z-20">
              ({hoverCell.x}, {hoverCell.y})
            </div>
          )}

          {mode === 'SELECT' && !selectedUnit && isMyTurn && (
            <div className="absolute bottom-8 text-slate-500 text-sm font-mono bg-slate-900/80 px-4 py-2 rounded-lg">
              Chọn đơn vị trên bản đồ để ra lệnh...
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-slate-900/80 backdrop-blur border-l border-slate-700/50 flex flex-col">
          {/* Commander Skill */}
          <div className="p-4 border-b border-slate-700/50">
            <h3 className="text-xs text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Zap className="w-4 h-4" /> SKILL CHỈ HUY
            </h3>
            <button
              onClick={activateSkill}
              disabled={!isMyTurn || me?.commanderUsed}
              className={clsx(
                'w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2',
                me?.commanderUsed
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20'
              )}
            >
              <Zap className="w-5 h-5" />
              {me?.commanderUsed ? 'ĐÃ SỬ DỤNG' : 'KÍCH HOẠT'}
            </button>
          </div>

          {/* Inventory */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="text-xs text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1">
              <Package className="w-4 h-4" /> VẬT PHẨM ({me?.usedSlots || 0}/{me?.maxSlots || CONSTANTS.MAX_SLOTS})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(inventory).map(([itemId, qty]) => {
                if (qty <= 0) return null;
                
                // Check if it's a structure
                const structDef = UNIT_DEFINITIONS[itemId];
                if (structDef?.type === 'STRUCTURE') {
                  return (
                    <motion.button
                      key={itemId}
                      whileHover={{ scale: isMyTurn ? 1.05 : 1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => isMyTurn && handleDeployStructure(itemId)}
                      disabled={!isMyTurn}
                      className={clsx(
                        'p-3 rounded-lg border text-left transition-all relative',
                        deployingStructure === itemId
                          ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : 'bg-slate-800/50 border-purple-500/30 text-slate-300',
                        !isMyTurn && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="font-bold text-xs truncate">{structDef.name}</div>
                      <div className="text-[10px] text-purple-400 mt-0.5">🏗️ Đặt xuống</div>
                      {qty > 1 && (
                        <span className="absolute top-1 right-1 bg-purple-500/20 text-purple-400 text-[10px] px-1.5 py-0.5 rounded">
                          x{qty}
                        </span>
                      )}
                    </motion.button>
                  );
                }
                
                // Regular item
                const itemDef = ITEMS[itemId];
                if (!itemDef) return null;

                const isNuke = itemId === 'NUKE';
                const canUseNuke = isNuke && hasActiveSilo;
                const isPassive = itemDef.type === 'PASSIVE';

                return (
                  <motion.button
                    key={itemId}
                    whileHover={{ scale: isMyTurn && !isPassive ? 1.05 : 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => isMyTurn && !isPassive && (!isNuke || canUseNuke) && handleSelectItem(itemId)}
                    disabled={!isMyTurn || isPassive || (isNuke && !canUseNuke)}
                    className={clsx(
                      'p-3 rounded-lg border text-left transition-all relative',
                      selectedItem?.itemId === itemId
                        ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                        : 'bg-slate-800/50 border-slate-700 text-slate-300',
                      (!isMyTurn || isPassive) && 'opacity-50 cursor-not-allowed',
                      isNuke && !canUseNuke && 'opacity-40 cursor-not-allowed',
                      isPassive && 'border-purple-500/30 bg-purple-500/10'
                    )}
                  >
                    <div className="font-bold text-xs truncate">{itemDef.name}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {isPassive ? '🛡️ Tự động' : '⚡ Chủ động'}
                    </div>
                    {isNuke && !hasActiveSilo && (
                      <div className="text-[9px] text-red-400 mt-1">Cần SILO</div>
                    )}
                    {qty > 1 && (
                      <span className="absolute top-1 right-1 bg-cyan-500/20 text-cyan-400 text-[10px] px-1.5 py-0.5 rounded">
                        x{qty}
                      </span>
                    )}
                  </motion.button>
                );
              })}
              {Object.keys(inventory).length === 0 && (
                <div className="col-span-2 text-center text-slate-600 py-4 italic text-sm">
                  Không có vật phẩm
                </div>
              )}
            </div>
          </div>

          {/* Battle Log */}
          <div className="h-1/3 bg-slate-950/50 border-t border-slate-700/50 p-3 overflow-y-auto">
            <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Clock className="w-3 h-3" /> NHẬT KÝ TRẬN ĐẤU
            </h3>
            <div className="space-y-1.5 font-mono text-xs flex flex-col-reverse">
              {logs.slice(-20).reverse().map((log, i) => {
                const formatted = formatLog(log);
                return (
                  <div
                    key={i}
                    className={clsx(
                      'px-2 py-1.5 rounded border-l-2',
                      formatted.type === 'HIT' || formatted.type === 'SUNK' || formatted.type === 'kill'
                        ? 'border-red-500 bg-red-500/5'
                        : formatted.type === 'MISS'
                        ? 'border-slate-600 bg-slate-800/30'
                        : formatted.isEnemy
                        ? 'border-orange-500/50 bg-orange-500/5'
                        : 'border-cyan-500/50 bg-cyan-500/5'
                    )}
                  >
                    <span className="text-slate-500">T{log.turn || logs.indexOf(log)}:</span>{' '}
                    <span className={clsx(
                      formatted.isEnemy ? 'text-orange-400' : 'text-slate-300'
                    )}>
                      {formatted.text}
                    </span>
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="text-slate-600 text-center py-2 italic">
                  Chưa có hoạt động
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drone Modal */}
      <AnimatePresence>
        {selectedItem?.requiresTarget === 'row_col' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={cancelAction}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 w-[450px]"
            >
              <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                <Eye className="w-6 h-6" /> Drone Trinh Sát
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-slate-400 block mb-2">Chọn hướng quét:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDroneAxis('row')}
                      className={clsx(
                        'py-3 rounded-lg border font-bold transition-all',
                        droneAxis === 'row'
                          ? 'bg-cyan-500 text-slate-900 border-cyan-500'
                          : 'border-slate-600 text-slate-400 hover:border-cyan-500'
                      )}
                    >
                      HÀNG (X) ↔
                    </button>
                    <button
                      onClick={() => setDroneAxis('col')}
                      className={clsx(
                        'py-3 rounded-lg border font-bold transition-all',
                        droneAxis === 'col'
                          ? 'bg-cyan-500 text-slate-900 border-cyan-500'
                          : 'border-slate-600 text-slate-400 hover:border-cyan-500'
                      )}
                    >
                      CỘT (Y) ↕
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-400 block mb-2">
                    Chọn {droneAxis === 'row' ? 'hàng' : 'cột'} (0-{mapData.length - 1}):
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={mapData.length - 1}
                      value={droneIndex}
                      onChange={(e) => setDroneIndex(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <input
                      type="number"
                      min={0}
                      max={mapData.length - 1}
                      value={droneIndex}
                      onChange={(e) => setDroneIndex(Math.min(mapData.length - 1, Math.max(0, parseInt(e.target.value) || 0)))}
                      className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-center font-mono text-lg focus:border-cyan-500 outline-none"
                    />
                  </div>
                </div>

                {/* Preview indicator */}
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <span className="text-slate-500 text-sm">
                    Quét {droneAxis === 'row' ? 'hàng' : 'cột'}{' '}
                    <span className="text-cyan-400 font-bold font-mono">{droneIndex}</span>
                  </span>
                  <div className="text-xs text-slate-600 mt-1">
                    (Toàn bộ {mapData.length} ô sẽ được quét)
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={cancelAction}
                    className="flex-1 py-3 rounded-lg border border-slate-600 text-slate-400 hover:bg-slate-800 transition-all"
                  >
                    HỦY
                  </button>
                  <button
                    onClick={() => {
                      handleItemUseWithParams('DRONE', { axis: droneAxis, index: droneIndex });
                    }}
                    className="flex-1 py-3 rounded-lg bg-cyan-500 text-slate-900 font-bold hover:bg-cyan-400 transition-all"
                  >
                    🛩️ QUÉT
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
