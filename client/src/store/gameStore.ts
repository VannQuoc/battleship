import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState, Unit } from '../types';
import toast from 'react-hot-toast';

// URL backend
const SOCKET_URL = 'http://localhost:3000'; 

interface StoreState extends GameState {
  socket: Socket | null;
  playerId: string | null;
  
  // Actions
  connect: () => void;
  createRoom: (name: string, roomId: string) => void;
  joinRoom: (name: string, roomId: string) => void;
  selectCommander: (commanderId: string) => void;
  buyItem: (itemId: string) => void;
  deployFleet: (ships: any[]) => void;
  moveUnit: (unitId: string, x: number, y: number) => void;
  fireShot: (x: number, y: number, preferredUnitId: string | null) => void;
  useItem: (itemId: string, params: any) => void;
  activateSkill: () => void;
}

const initialState: GameState = {
  roomId: null,
  status: 'LOBBY',
  turn: null,
  mapData: [],
  me: { points: 0, fleet: [], inventory: [], activeEffects: { jammer: 0, admiralVision: 0 }, commander: null },
  opponent: { name: 'Waiting...', fleet: [] },
  logs: [],
};

export const useGameStore = create<StoreState>((set, get) => ({
  ...initialState,
  socket: null,
  playerId: null,

  connect: () => {
    if (get().socket) return;
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected:', socket.id);
      set({ playerId: socket.id });
    });

    socket.on('room_created', (data) => {
      set({ roomId: data.roomId, mapData: data.mapData, status: 'LOBBY' });
      toast.success(`Room ${data.roomId} Created!`);
    });

    socket.on('room_info', (data) => {
      set({ roomId: data.roomId, mapData: data.mapData, status: 'LOBBY' });
    });

    socket.on('game_state', (state) => {
      // Sync full state logic từ server
      set({
        status: state.status,
        turn: state.turn,
        me: state.me,
        opponent: state.opponent,
        logs: state.logs,
        // mapData update if needed (spy skill)
        ...(state.mapData ? { mapData: state.mapData } : {})
      });
    });

    socket.on('room_log', (msg) => toast(msg, { icon: '📡' }));
    
    socket.on('game_started', () => {
        set({ status: 'BATTLE' });
        toast.success("BATTLE STARTED!", { duration: 3000, icon: '⚔️' });
    });

    socket.on('error', (msg) => toast.error(msg));

    // Hiệu ứng Visual (Nổ, Đạn bay) - Xử lý sau ở Component
    socket.on('effect_trigger', (data) => {
        // Có thể dispatch event custom window để component bắt
        window.dispatchEvent(new CustomEvent('GAME_EFFECT', { detail: data }));
    });
    
    socket.on('game_over', (data) => {
        set({ status: 'ENDED', winner: data.winner });
        toast(data.reason, { icon: '🏁' });
    });

    set({ socket });
  },

  createRoom: (name, roomId) => get().socket?.emit('create_room', { name, roomId }),
  joinRoom: (name, roomId) => get().socket?.emit('join_room', { name, roomId }),
  selectCommander: (cmdId) => get().socket?.emit('select_commander', { roomId: get().roomId, commanderId: cmdId }),
  buyItem: (itemId) => get().socket?.emit('buy_item', { roomId: get().roomId, itemId }),
  
  deployFleet: (ships) => get().socket?.emit('deploy_fleet', { roomId: get().roomId, ships }),
  
  moveUnit: (unitId, x, y) => get().socket?.emit('move_unit', { roomId: get().roomId, unitId, x, y }),
  fireShot: (x, y, prefId) => get().socket?.emit('fire_shot', { roomId: get().roomId, x, y, preferredUnitId: prefId }),
  useItem: (itemId, params) => get().socket?.emit('use_item', { roomId: get().roomId, itemId, params }),
  activateSkill: () => get().socket?.emit('activate_skill', { roomId: get().roomId }),
}));