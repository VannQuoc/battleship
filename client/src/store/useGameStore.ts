// client/src/store/useGameStore.ts
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import type {
  GameStatus,
  GameConfig,
  Player,
  Opponent,
  TerrainType,
  LogEntry,
  EffectTrigger,
  ShipPlacement,
  ItemUseParams,
  PublicPlayer,
  LobbyData,
} from '../types';

// ============================================================
// STORE INTERFACE
// ============================================================
interface GameStore {
  // Connection State
  socket: Socket | null;
  isConnected: boolean;
  playerId: string | null;

  // Room State
  roomId: string | null;
  hostId: string | null;
  config: GameConfig | null;

  // Game State
  status: GameStatus;
  turn: string | null;
  mapData: TerrainType[][];
  me: Player | null;
  opponent: Opponent | null;
  players: Record<string, PublicPlayer>; // All players public data
  logs: LogEntry[];

  // Effects State
  lastEffect: EffectTrigger | null;

  // Winner State
  winner: string | null;
  winReason: string | null;

  // Actions
  connect: (url: string) => void;
  disconnect: () => void;
  createRoom: (name: string, roomId: string, config?: Partial<GameConfig>) => void;
  joinRoom: (name: string, roomId: string) => void;
  selectCommander: (commanderId: string) => void;
  buyItem: (itemId: string) => void;
  sellItem: (itemId: string) => void;
  setReady: (ready: boolean) => void;
  startGame: () => void;
  deployFleet: (ships: ShipPlacement[]) => void;
  moveUnit: (unitId: string, x: number, y: number) => void;
  fireShot: (x: number, y: number, preferredUnitId?: string) => void;
  useItem: (itemId: string, params: ItemUseParams) => void;
  activateSkill: () => void;
  clearEffect: () => void;
  reset: () => void;
}

// ============================================================
// INITIAL STATE
// ============================================================
const initialState = {
  socket: null,
  isConnected: false,
  playerId: null,
  roomId: null,
  hostId: null,
  config: null,
  status: 'IDLE' as GameStatus,
  turn: null,
  mapData: [] as TerrainType[][],
  me: null,
  opponent: null,
  players: {} as Record<string, PublicPlayer>,
  logs: [],
  lastEffect: null,
  winner: null,
  winReason: null,
};

// ============================================================
// STORE IMPLEMENTATION
// ============================================================
export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  // ==========================================================
  // CONNECTION
  // ==========================================================
  connect: (url: string) => {
    const existingSocket = get().socket;
    
    // If socket exists and is connecting or connected, don't create new one
    if (existingSocket) {
      if (existingSocket.connected) return;
      // Disconnect old socket before creating new one
      existingSocket.disconnect();
    }

    console.log('[CLIENT] Connecting to:', url);
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });

    // Save socket immediately
    set({ socket });

    // --- Connection Events ---
    socket.on('connect', () => {
      console.log('[CLIENT] Connected! Socket ID:', socket.id);
      set({ isConnected: true, playerId: socket.id });
      toast.success('Kết nối thành công!', { icon: '🔗' });
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
      toast.error('Mất kết nối server!', { icon: '⚠️' });
    });

    socket.on('connect_error', (err) => {
      toast.error(`Lỗi kết nối: ${err.message}`, { icon: '❌' });
    });

    // --- Room Events ---
    socket.on('room_created', (data: { 
      roomId: string; 
      config: GameConfig; 
      mapData: TerrainType[][]; 
      hostId: string;
      players?: Record<string, PublicPlayer>;
    }) => {
      console.log('[CLIENT] room_created:', data);
      set({
        roomId: data.roomId,
        config: data.config,
        mapData: data.mapData,
        hostId: data.hostId,
        players: data.players || {},
        status: 'LOBBY',
      });
      toast.success(`Phòng ${data.roomId} đã tạo!`, { icon: '🎮' });
    });

    socket.on('room_info', (data: { 
      roomId: string; 
      config: GameConfig; 
      mapData: TerrainType[][]; 
      hostId: string;
      players?: Record<string, PublicPlayer>;
    }) => {
      console.log('[CLIENT] room_info:', data);
      set({
        roomId: data.roomId,
        config: data.config,
        mapData: data.mapData,
        hostId: data.hostId,
        players: data.players || {},
        status: 'LOBBY',
      });
      toast.success(`Đã tham gia phòng ${data.roomId}!`, { icon: '✅' });
    });

    // --- Lobby Update (new event) ---
    socket.on('lobby_update', (data: LobbyData) => {
      console.log('[CLIENT] lobby_update:', data);
      set({
        status: data.status,
        hostId: data.hostId,
        config: data.config,
        players: data.players || {},
        mapData: data.mapData,
      });
    });

    socket.on('player_joined', (data: { id: string; name: string }) => {
      toast(`${data.name} đã tham gia!`, { icon: '👋' });
    });

    socket.on('room_log', (msg: string) => {
      toast(msg, {
        position: 'bottom-left',
        style: { fontSize: '12px', background: '#1e293b', color: '#9ca3af' },
      });
    });

    // --- Game Phase Change ---
    socket.on('game_phase_change', (data: { phase: string; message: string }) => {
      if (data.phase === 'SETUP') {
        set({ status: 'SETUP' });
        toast.success(data.message, { icon: '🚢', duration: 3000 });
      } else if (data.phase === 'BATTLE') {
        set({ status: 'BATTLE' });
        toast('⚔️ CHIẾN ĐẤU BẮT ĐẦU!', {
          duration: 3000,
          style: { background: '#ef4444', color: '#fff', fontWeight: 'bold' },
        });
      }
    });

    // --- Game State Updates ---
    socket.on('game_state', (state: {
      status: GameStatus;
      mapData: TerrainType[][];
      turn: string;
      hostId: string;
      me: Player;
      opponent: Opponent;
      opponents?: Record<string, Opponent>;
      players?: Record<string, PublicPlayer>;
      logs: LogEntry[];
      config?: GameConfig;
    }) => {
      set({
        status: state.status,
        mapData: state.mapData,
        turn: state.turn,
        hostId: state.hostId,
        me: state.me,
        opponent: state.opponent,
        players: state.players || {},
        logs: state.logs,
        config: state.config || get().config,
      });
    });

    socket.on('game_started', (data: { turnQueue: string[] }) => {
      set({ status: 'BATTLE' });
      toast('⚔️ CHIẾN ĐẤU BẮT ĐẦU!', {
        duration: 3000,
        style: { background: '#ef4444', color: '#fff', fontWeight: 'bold' },
      });
    });

    // --- Effect Events ---
    socket.on('effect_trigger', (data: EffectTrigger) => {
      set({ lastEffect: data });
      handleEffectToast(data);
      setTimeout(() => set({ lastEffect: null }), 2000);
    });

    // --- Game Over ---
    socket.on('game_over', (data: { 
      winnerId?: string; 
      winnerName?: string; 
      reason: string; 
    }) => {
      set({
        status: 'ENDED',
        winner: data.winnerName || 'Unknown',
        winReason: data.reason,
      });
      toast(`🏁 KẾT THÚC! Người thắng: ${data.winnerName}\n${data.reason}`, {
        duration: 10000,
      });
    });

    // --- Error Handling ---
    socket.on('error', (msg: string) => {
      toast.error(msg, { duration: 4000 });
    });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ ...initialState });
    }
  },

  // ==========================================================
  // ROOM ACTIONS
  // ==========================================================
  createRoom: (name, roomId, config) => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('create_room', {
      name,
      roomId,
      config: {
        mapSize: config?.mapSize || 30,
        points: config?.startingPoints || 3000,
        maxPlayers: config?.maxPlayers || 2,
      },
    });
  },

  joinRoom: (name, roomId) => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('join_room', { name, roomId });
  },

  // ==========================================================
  // LOBBY ACTIONS
  // ==========================================================
  selectCommander: (commanderId) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('select_commander', { roomId, commanderId });
  },

  buyItem: (itemId) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('buy_item', { roomId, itemId });
  },

  sellItem: (itemId) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('sell_item', { roomId, itemId });
  },

  setReady: (ready) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('player_ready', { roomId, ready });
  },

  startGame: () => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('start_game', { roomId });
  },

  // ==========================================================
  // SETUP ACTIONS
  // ==========================================================
  deployFleet: (ships) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('deploy_fleet', { roomId, ships });
  },

  // ==========================================================
  // BATTLE ACTIONS
  // ==========================================================
  moveUnit: (unitId, x, y) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('move_unit', { roomId, unitId, x, y });
  },

  fireShot: (x, y, preferredUnitId) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('fire_shot', { roomId, x, y, preferredUnitId });
  },

  useItem: (itemId, params) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('use_item', { roomId, itemId, params });
  },

  activateSkill: () => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('activate_skill', { roomId });
  },

  // ==========================================================
  // UTILITY ACTIONS
  // ==========================================================
  clearEffect: () => set({ lastEffect: null }),

  reset: () => {
    const socket = get().socket;
    if (socket) socket.disconnect();
    set({ ...initialState });
  },
}));

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function handleEffectToast(data: EffectTrigger) {
  switch (data.type) {
    case 'SHOT':
      if (data.result === 'HIT') toast.success('🎯 TRÚNG MỤC TIÊU!');
      else if (data.result === 'SUNK') toast.success('💥 ĐÃ ĐÁNH CHÌM TÀU ĐỊCH!');
      else if (data.result === 'BLOCKED_TERRAIN') toast.error('⛰️ ĐẠN BỊ CHẶN BỞI ĐẢO!');
      else if (data.result === 'MISS') toast('🌊 TRƯỢT!', { icon: '💨' });
      else if (data.result === 'NO_EFFECT') toast('❌ KHÔNG CÓ TÁC DỤNG!');
      break;

    case 'SPY_REVEAL':
      toast('👁️ CẢNH BÁO: ĐIỆP VIÊN ĐANG QUÉT BẢN ĐỒ!', {
        duration: 3000,
        style: { background: '#8b5cf6', color: '#fff' },
      });
      break;

    case 'ITEM_USE':
      handleItemToast(data);
      break;
  }
}

function handleItemToast(data: EffectTrigger) {
  switch (data.itemId) {
    case 'REPAIR_KIT':
      toast.success(`🔧 Đã sửa chữa! +${data.amount} HP`);
      break;
    case 'DRONE':
      if (data.msg) {
        // Anti-Air blocked the drone
        toast.error(`🚫 ${data.msg}`);
      } else if (data.findings && data.findings.length > 0) {
        const targets = data.findings.map((f: any) => f.name || f.type).join(', ');
        toast.success(`🛩️ Drone phát hiện ${data.findings.length} mục tiêu: ${targets}`, {
          duration: 5000,
        });
      } else {
        toast('🛩️ Drone quét xong - Không phát hiện mục tiêu.', { icon: '📡' });
      }
      break;
    case 'ENGINE_BOOST':
      toast.success(`🚀 Đã dịch chuyển! (Đơn vị bị lộ)`, { icon: '👁️' });
      break;
    case 'DECOY':
      toast.success('🎭 Đã đặt mồi nhử!');
      break;
    case 'JAMMER':
      toast.success('📡 Phá sóng kích hoạt (3 lượt)!');
      break;
    case 'MERCENARY':
      toast.success('🗡️ Lính đánh thuê đã được triển khai!');
      break;
    case 'SUICIDE_SQUAD':
      toast.success(`💣 Lính cảm tử nổ! ${data.hits?.length || 0} mục tiêu bị ảnh hưởng`);
      break;
    case 'BLACK_HAT':
      if (data.type === 'BLOCKED_TRAP') {
        toast.error(`🛡️ ${data.msg}`);
      } else {
        toast.success('💻 Hack thành công! Đã chiếm công trình!');
      }
      break;
    case 'NUKE':
      toast(`☢️ NUKE ĐÃ PHÓNG! ${data.destroyed?.length || 0} mục tiêu bị hủy diệt!`, {
        duration: 5000,
        style: { background: '#dc2626', color: '#fff', fontWeight: 'bold' },
      });
      break;
    case 'SELF_DESTRUCT':
      toast(`💥 TỰ HỦY! ${data.hits?.length || 0} mục tiêu bị ảnh hưởng`, {
        style: { background: '#f97316', color: '#fff' },
      });
      break;
    default:
      if (data.msg) toast(data.msg);
  }
}

// ============================================================
// SELECTORS
// ============================================================
export const useIsMyTurn = () =>
  useGameStore((state) => state.turn === state.playerId);

export const useIsHost = () =>
  useGameStore((state) => state.hostId === state.playerId);

export const useMyFleet = () =>
  useGameStore((state) => state.me?.fleet || []);

export const useOpponentFleet = () =>
  useGameStore((state) => state.opponent?.fleet || []);

export const useInventory = () =>
  useGameStore((state) => state.me?.inventory || {});

export const usePoints = () =>
  useGameStore((state) => state.me?.points || 0);

export const useGameStatus = () =>
  useGameStore((state) => state.status);

export const useMapData = () =>
  useGameStore((state) => state.mapData);

export const usePlayers = () =>
  useGameStore((state) => state.players);

export const useAllPlayersReady = () =>
  useGameStore((state) => {
    const players = Object.values(state.players);
    if (players.length < 2) return false;
    return players.every(p => p.ready);
  });
