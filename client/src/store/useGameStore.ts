import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, TerrainType } from '../types';
import toast from 'react-hot-toast';

interface GameStore extends GameState {
  socket: Socket | null;
  
  // Actions
  connect: (url: string) => void;
  createRoom: (name: string, roomId: string) => void;
  joinRoom: (name: string, roomId: string) => void;
  deployFleet: (ships: any[]) => void;
  fireShot: (x: number, y: number, preferredUnitId?: string) => void;
  reset: () => void;
  
  // Socket Listeners Setters
  setGameState: (state: Partial<GameState>) => void;
}

const initialState: Omit<GameStore, 'socket' | 'connect' | 'createRoom' | 'joinRoom' | 'deployFleet' | 'fireShot' | 'reset' | 'setGameState'> = {
  roomId: null,
  playerId: null,
  status: 'LOBBY',
  turn: null,
  mapData: [],
  me: null,
  opponent: null,
  logs: [],
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,
  socket: null,

  connect: (url: string) => {
    if (get().socket) return;
    const socket = io(url);

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
      set({ playerId: socket.id });
    });

    // Handle Room Info (Map Data & Config)
    socket.on('room_created', (data) => {
      set({ roomId: data.roomId, mapData: data.mapData, status: 'LOBBY' });
      toast.success(`Room ${data.roomId} created!`);
    });
    
    socket.on('room_info', (data) => {
       set({ roomId: data.roomId, mapData: data.mapData, status: 'LOBBY' });
    });

    socket.on('game_state', (state) => {
      // Sync full state from server
      set({
        status: state.status,
        turn: state.turn,
        me: state.me,
        opponent: state.opponent,
        logs: state.logs,
        mapData: state.mapData || get().mapData // Backup nếu server gửi thiếu
      });
      
      // Xử lý Logs mới nhất để Toast (UI/UX Requirement 5.4)
      const lastLog = state.logs[state.logs.length - 1];
      if (lastLog && !lastLog.isToastShown) {
         // Logic hiển thị toast tùy loại log
         // (Lưu ý: Cần cơ chế đánh dấu log đã đọc ở Client để tránh spam)
      }
    });

    socket.on('game_started', () => {
      set({ status: 'BATTLE' });
      toast('BATTLE START!', { icon: '⚔️' });
    });
    
    socket.on('effect_trigger', (data) => {
        // Đây là nơi trigger Animation (Nổ, Đạn bay)
        // Sẽ được xử lý bởi component EffectLayer
        console.log('Visual Effect:', data);
        if(data.type === 'SHOT' && data.result === 'HIT') toast.success('Target HIT!');
        if(data.type === 'SHOT' && data.result === 'BLOCKED_TERRAIN') toast.error('Blocked by Terrain!');
    });

    socket.on('error', (msg) => toast.error(msg));

    set({ socket });
  },

  createRoom: (name, roomId) => {
    get().socket?.emit('create_room', { name, roomId });
  },

  joinRoom: (name, roomId) => {
    get().socket?.emit('join_room', { name, roomId });
  },

  deployFleet: (ships) => {
    const { roomId } = get();
    if(roomId) get().socket?.emit('deploy_fleet', { roomId, ships });
  },

  fireShot: (x, y, preferredUnitId) => {
    const { roomId } = get();
    if(roomId) get().socket?.emit('fire_shot', { roomId, x, y, preferredUnitId });
  },
  
  setGameState: (state) => set(state),
  
  reset: () => set({ ...initialState, socket: null })
}));