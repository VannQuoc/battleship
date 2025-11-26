// client/src/screens/LobbyScreen.tsx
import { useState, useEffect, useMemo } from 'react';
import { useGameStore, useIsHost, useAllPlayersReady, usePlayers } from '../store/useGameStore';
import {
  CONSTANTS,
  COMMANDERS,
  getStructures,
  getPurchasableItems,
  calculatePrice,
  getItemName,
} from '../config/constants';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import {
  Anchor,
  Radio,
  Shield,
  Package,
  DollarSign,
  Users,
  Map,
  AlertCircle,
  Check,
  Play,
  Crown,
  User,
  Clock,
  Trash2,
  Settings,
  ArrowLeft,
} from 'lucide-react';

type ShopTab = 'structures' | 'items';
type ScreenMode = 'main' | 'create_settings' | 'lobby';

export const LobbyScreen = () => {
  const {
    connect,
    createRoom,
    joinRoom,
    selectCommander,
    buyItem,
    sellItem,
    setReady,
    startGame,
    roomId,
    isConnected,
    config,
    playerId,
    hostId,
  } = useGameStore();

  const players = usePlayers();
  const isHost = useIsHost();
  const allPlayersReady = useAllPlayersReady();

  // --- Screen State ---
  const [screenMode, setScreenMode] = useState<ScreenMode>('main');

  // --- Connection Form State ---
  const [name, setName] = useState('');
  const [roomInput, setRoomInput] = useState('');
  
  // --- Create Room Settings ---
  const [mapSize, setMapSize] = useState(CONSTANTS.DEFAULT_MAP_SIZE.toString());
  const [points, setPoints] = useState(CONSTANTS.DEFAULT_POINTS.toString());
  const [maxPlayers, setMaxPlayers] = useState('2');

  // --- Lobby State ---
  const [selectedCmd, setSelectedCmd] = useState<string | null>(null);
  const [shopTab, setShopTab] = useState<ShopTab>('structures');
  const [isReady, setIsReady] = useState(false);

  // --- Auto-connect on mount ---
  useEffect(() => {
    if (!isConnected) {
      connect();
    }
  }, [isConnected, connect]);

  // --- Switch to lobby when roomId is set ---
  useEffect(() => {
    if (roomId) {
      setScreenMode('lobby');
    }
  }, [roomId]);

  // --- Sync local ready state with server ---
  useEffect(() => {
    const myData = players[playerId || ''];
    if (myData) {
      setIsReady(myData.ready);
      if (myData.commander) setSelectedCmd(myData.commander);
    }
  }, [players, playerId]);

  // --- My data from players object ---
  const myData = playerId ? players[playerId] : null;

  // --- Calculate discount for Engineer ---
  const discount = useMemo(() => {
    if (selectedCmd === 'ENGINEER') return CONSTANTS.ENGINEER_DISCOUNT;
    return myData?.buildingDiscount || 0;
  }, [selectedCmd, myData?.buildingDiscount]);

  // --- Inventory slot calculation ---
  const usedSlots = myData?.usedSlots || 0;
  const maxSlots = myData?.maxSlots || CONSTANTS.MAX_SLOTS;
  const slotsFull = usedSlots >= maxSlots;

  // --- Handlers ---
  const handleGoToCreateSettings = () => {
    if (!name.trim()) {
      return;
    }
    setScreenMode('create_settings');
  };

  const handleCreateRoom = () => {
    if (!name.trim() || !roomInput.trim()) return;
    createRoom(name, roomInput, {
      mapSize: parseInt(mapSize) || 30,
      startingPoints: parseInt(points) || 3000,
      maxPlayers: parseInt(maxPlayers) || 2,
    });
  };

  const handleJoinRoom = () => {
    if (!name.trim() || !roomInput.trim()) return;
    joinRoom(name, roomInput);
  };

  const handleSelectCommander = (cmdId: string) => {
    if (isReady) return;
    setSelectedCmd(cmdId);
    selectCommander(cmdId);
  };

  const handleBuy = (itemId: string) => {
    if (isReady || slotsFull) return;
    buyItem(itemId);
  };

  const handleSell = (itemId: string) => {
    if (isReady) return;
    sellItem(itemId);
  };

  const handleReadyToggle = () => {
    const newReady = !isReady;
    setIsReady(newReady);
    setReady(newReady);
  };

  const handleStartGame = () => {
    if (!isHost || !allPlayersReady) return;
    startGame();
  };

  // ============================================================
  // RENDER: Main Menu Screen
  // ============================================================
  if (screenMode === 'main' && !roomId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 p-8 w-[400px]"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center">
                <Anchor className="w-8 h-8 text-slate-900" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
              BATTLESHIP TACTICS
            </h1>
            <p className="text-slate-400 mt-2 text-sm">LAN Commanders</p>
          </div>

          {/* Connection Status */}
          <div className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg mb-6 text-sm',
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
          )}>
            <Radio className={clsx('w-4 h-4', isConnected && 'animate-pulse')} />
            {isConnected ? 'Đã kết nối Server' : 'Đang kết nối...'}
          </div>

          {/* Name Input */}
          <div className="mb-4">
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 block">
              Tên Chỉ Huy
            </label>
            <input
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-cyan-300 placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên của bạn..."
            />
          </div>

          {/* Room ID Input */}
          <div className="mb-6">
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 block">
              Mã Phòng
            </label>
            <input
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="VD: ROOM-001"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleGoToCreateSettings}
              disabled={!isConnected || !name.trim()}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-900 font-bold py-3 rounded-lg hover:from-cyan-400 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              TẠO PHÒNG
            </button>
            <button
              onClick={handleJoinRoom}
              disabled={!isConnected || !name.trim() || !roomInput.trim()}
              className="flex-1 border-2 border-cyan-500 text-cyan-400 font-bold py-3 rounded-lg hover:bg-cyan-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              THAM GIA
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Create Room Settings Screen
  // ============================================================
  if (screenMode === 'create_settings' && !roomId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative z-10 bg-slate-900/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 p-8 w-[450px]"
        >
          {/* Back Button */}
          <button
            onClick={() => setScreenMode('main')}
            className="absolute top-4 left-4 text-slate-400 hover:text-white flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>

          {/* Header */}
          <div className="text-center mb-8 mt-4">
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
              CÀI ĐẶT PHÒNG
            </h2>
            <p className="text-slate-400 mt-2 text-sm">Chỉ huy: <span className="text-cyan-400">{name}</span></p>
          </div>

          {/* Room ID */}
          <div className="mb-4">
            <label className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1 block">
              Mã Phòng
            </label>
            <input
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              placeholder="Nhập mã phòng..."
            />
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Map className="w-3 h-3" /> Kích thước Map
              </label>
              <input
                type="number"
                min="20"
                max="80"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-3 text-white text-center font-mono text-lg focus:border-cyan-500 outline-none"
                value={mapSize}
                onChange={(e) => setMapSize(e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1 text-center">20-80 ô</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Tiền khởi đầu
              </label>
              <input
                type="number"
                step="500"
                min="1000"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-3 text-white text-center font-mono text-lg focus:border-cyan-500 outline-none"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1 text-center">Số $</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> Số người chơi
              </label>
              <input
                type="number"
                min="2"
                max="10"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-3 text-white text-center font-mono text-lg focus:border-cyan-500 outline-none"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              />
              <p className="text-[10px] text-slate-500 mt-1 text-center">2-10 người</p>
            </div>
          </div>

          {/* Create Button */}
          <button
            onClick={handleCreateRoom}
            disabled={!roomInput.trim()}
            className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-900 font-bold py-4 rounded-xl hover:from-cyan-400 hover:to-emerald-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            TẠO PHÒNG
          </button>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Lobby Screen
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-700/50 px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
            PHÒNG CHUẨN BỊ
          </h2>
          <p className="text-slate-400 text-sm">
            Mã phòng: <span className="text-cyan-400 font-mono">{roomId}</span>
            {isHost && <span className="ml-2 text-yellow-400">(Chủ phòng)</span>}
          </p>
        </div>
        <div className="flex items-center gap-6">
          {/* Points Display */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-yellow-400" />
            <span className="text-2xl font-bold font-mono text-yellow-400">
              {myData?.points || 0}
            </span>
          </div>
          {/* Inventory Slots */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-2">
            <Package className="w-5 h-5 text-cyan-400" />
            <span className={clsx(
              'text-lg font-mono font-bold',
              slotsFull ? 'text-red-400' : 'text-cyan-400'
            )}>
              {usedSlots}/{maxSlots}
            </span>
            <span className="text-xs text-slate-500">slots</span>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Left Panel: Players + Commander */}
        <div className="w-1/3 border-r border-slate-700/50 flex flex-col">
          {/* Players List */}
          <div className="p-4 border-b border-slate-700/50">
            <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" /> NGƯỜI CHƠI ({Object.keys(players).length}/{config?.maxPlayers || 2})
            </h3>
            <div className="space-y-2">
              {Object.values(players).map((player) => {
                const isMe = player.id === playerId;
                const cmdInfo = COMMANDERS.find(c => c.id === player.commander);
                
                return (
                  <div
                    key={player.id}
                    className={clsx(
                      'p-3 rounded-lg border transition-all',
                      player.ready
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-800/50 border-slate-700',
                      isMe && 'ring-1 ring-cyan-500/50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {player.id === hostId && <Crown className="w-4 h-4 text-yellow-400" />}
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-bold">
                          {player.name}
                          {isMe && <span className="text-cyan-400 text-xs ml-1">(Bạn)</span>}
                        </span>
                      </div>
                      {player.ready ? (
                        <span className="bg-emerald-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                          <Check className="w-3 h-3" /> READY
                        </span>
                      ) : (
                        <span className="bg-slate-600 text-slate-300 text-xs px-2 py-1 rounded flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Waiting
                        </span>
                      )}
                    </div>
                    
                    {/* Show commander and items */}
                    <div className="text-xs space-y-1">
                      {cmdInfo && (
                        <div className="flex items-center gap-1 text-purple-400">
                          <Shield className="w-3 h-3" />
                          <span>{cmdInfo.name}</span>
                        </div>
                      )}
                      {player.inventory && Object.keys(player.inventory).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(player.inventory).map(([itemId, qty]) => (
                            <span key={itemId} className="bg-slate-700/50 px-1.5 py-0.5 rounded text-slate-400">
                              {getItemName(itemId)} {qty > 1 && `x${qty}`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commander Selection */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h3 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" /> CHỌN CHỈ HUY
            </h3>
            <div className="space-y-3">
              {COMMANDERS.map((cmd) => (
                <motion.div
                  key={cmd.id}
                  whileHover={{ scale: isReady ? 1 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectCommander(cmd.id)}
                  className={clsx(
                    'cursor-pointer border-2 rounded-xl p-4 transition-all',
                    selectedCmd === cmd.id
                      ? 'border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600',
                    isReady && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={clsx(
                      'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                      selectedCmd === cmd.id
                        ? 'bg-gradient-to-br from-cyan-400 to-emerald-400'
                        : 'bg-slate-700'
                    )}>
                      {cmd.id === 'ADMIRAL' ? '⭐' : cmd.id === 'SPY' ? '🕵️' : '🔧'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        {cmd.name}
                        {selectedCmd === cmd.id && <Check className="w-4 h-4 text-emerald-400" />}
                      </h4>
                      <p className="text-xs text-slate-400">{cmd.desc}</p>
                      <div className="text-[10px] text-purple-400 mt-1">⚡ {cmd.skill}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Ready & Start Buttons */}
          <div className="p-4 border-t border-slate-700/50 space-y-3">
            <button
              onClick={handleReadyToggle}
              disabled={!selectedCmd}
              className={clsx(
                'w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2',
                isReady
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                !selectedCmd && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isReady ? (
                <><Check className="w-5 h-5" /> SẴN SÀNG</>
              ) : (
                <><Clock className="w-5 h-5" /> NHẤN ĐỂ SẴN SÀNG</>
              )}
            </button>

            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={!allPlayersReady || Object.keys(players).length < 2}
                className={clsx(
                  'w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2',
                  allPlayersReady && Object.keys(players).length >= 2
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-900 hover:from-cyan-400 hover:to-emerald-400'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                )}
              >
                <Play className="w-5 h-5" /> BẮT ĐẦU GAME
              </button>
            )}

            {!isHost && (
              <div className="text-center text-sm text-slate-500">
                Chờ chủ phòng bắt đầu...
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Shop */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
              <Package className="w-5 h-5" /> CỬA HÀNG
            </h3>

            {/* Tab Buttons */}
            <div className="flex bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setShopTab('structures')}
                className={clsx(
                  'px-4 py-2 rounded-md text-sm font-medium transition-all',
                  shopTab === 'structures'
                    ? 'bg-cyan-500 text-slate-900'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Công trình
              </button>
              <button
                onClick={() => setShopTab('items')}
                className={clsx(
                  'px-4 py-2 rounded-md text-sm font-medium transition-all',
                  shopTab === 'items'
                    ? 'bg-cyan-500 text-slate-900'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                Vật phẩm
              </button>
            </div>
          </div>

          {/* Warnings */}
          {isReady && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 flex items-center gap-2 text-yellow-400">
              <AlertCircle className="w-5 h-5" />
              <span>Bạn đã sẵn sàng! Hủy sẵn sàng để mua/bán.</span>
            </div>
          )}

          {/* Shop Items Grid */}
          <div className="grid grid-cols-2 gap-4">
            {shopTab === 'structures' &&
              getStructures().map((struct) => {
                const price = calculatePrice(struct.code, discount);
                const originalPrice = struct.cost;
                const canAfford = (myData?.points || 0) >= price;
                const hasDiscount = discount > 0;
                const alreadyOwned = myData?.inventory?.[struct.code] || 0;

                return (
                  <motion.div
                    key={struct.code}
                    whileHover={{ scale: canAfford && !isReady && !slotsFull ? 1.02 : 1 }}
                    className={clsx(
                      'bg-slate-800/80 border rounded-xl p-4 transition-all',
                      canAfford && !isReady && !slotsFull
                        ? 'border-slate-600 hover:border-cyan-500/50 cursor-pointer'
                        : 'border-slate-700/50 opacity-60'
                    )}
                    onClick={() => canAfford && !isReady && !slotsFull && handleBuy(struct.code)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-white">{struct.name}</h4>
                        <span className="text-xs text-slate-500">Size: {struct.size}</span>
                      </div>
                      {struct.alwaysVisible && (
                        <span className="bg-yellow-500/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded">VISIBLE</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{struct.desc}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {hasDiscount && (
                          <span className="text-sm text-slate-500 line-through">{originalPrice}</span>
                        )}
                        <span className={clsx('text-lg font-bold font-mono', hasDiscount ? 'text-emerald-400' : 'text-yellow-400')}>
                          ${price}
                        </span>
                      </div>
                      {alreadyOwned > 0 && (
                        <span className="bg-cyan-500/20 text-cyan-400 text-xs px-2 py-1 rounded">x{alreadyOwned}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}

            {shopTab === 'items' &&
              getPurchasableItems().map((item) => {
                const canAfford = (myData?.points || 0) >= item.cost;
                const isPassive = item.type === 'PASSIVE';
                const alreadyOwned = myData?.inventory?.[item.id] || 0;

                return (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: canAfford && !isReady && !slotsFull ? 1.02 : 1 }}
                    className={clsx(
                      'bg-slate-800/80 border rounded-xl p-4 transition-all',
                      canAfford && !isReady && !slotsFull
                        ? 'border-slate-600 hover:border-cyan-500/50 cursor-pointer'
                        : 'border-slate-700/50 opacity-60'
                    )}
                    onClick={() => canAfford && !isReady && !slotsFull && handleBuy(item.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-bold text-white">{item.name}</h4>
                      <span className={clsx(
                        'text-[10px] px-2 py-0.5 rounded',
                        isPassive ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'
                      )}>
                        {item.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{item.desc}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold font-mono text-yellow-400">${item.cost}</span>
                      {alreadyOwned > 0 && (
                        <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2 py-1 rounded">x{alreadyOwned}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
          </div>

          {/* Current Inventory with Sell Buttons */}
          {myData && Object.keys(myData.inventory).length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" /> TRONG KHO ({usedSlots}/{maxSlots} slots)
                <span className="text-xs text-slate-500 font-normal">• Hoàn trả 80%</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(myData.inventory).map(([itemId, qty]) => (
                  <div
                    key={itemId}
                    className="bg-slate-700/50 border border-slate-600 px-3 py-2 rounded-lg text-sm flex items-center gap-2 group"
                  >
                    <span>{getItemName(itemId)}</span>
                    {qty > 1 && (
                      <span className="bg-cyan-500/20 text-cyan-400 text-xs px-1.5 py-0.5 rounded">x{qty}</span>
                    )}
                    {!isReady && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSell(itemId); }}
                        className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Bán (hoàn 80%)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
