import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { GameState } from '../types';
import toast from 'react-hot-toast';

// 1. Define Interface
interface GameStore extends GameState {
  socket: Socket | null;
  lastEffect: any | null;
  
  // All required actions
  connect: (url: string) => void;
  createRoom: (name: string, roomId: string) => void;
  joinRoom: (name: string, roomId: string) => void;
  selectCommander: (id: string) => void;
  deployFleet: (ships: any[]) => void;
  buyItem: (itemId: string) => void;
  moveUnit: (unitId: string, x: number, y: number) => void;
  fireShot: (x: number, y: number, preferredUnitId?: string) => void;
  useItem: (itemId: string, params: any) => void;
  activateSkill: () => void;
  reset: () => void;
}

// 2. Initial State
const initialDataState = {
  roomId: null,
  playerId: null,
  status: 'LOBBY' as const,
  turn: null,
  mapData: [],
  me: null,
  opponent: null,
  logs: [],
  lastEffect: null,
  socket: null,
};

// 3. Store Implementation
export const useGameStore = create<GameStore>((set, get) => ({
  ...initialDataState,

  connect: (url: string) => {
    if (get().socket) return;
    const socket = io(url);

    socket.on('connect', () => set({ playerId: socket.id }));
    
    socket.on('room_created', (data) => {
      set({ roomId: data.roomId, mapData: data.mapData, status: 'LOBBY' });
      toast.success(`Room ${data.roomId} ready!`);
    });
    
    socket.on('room_info', (data) => set({ roomId: data.roomId, mapData: data.mapData, status: 'LOBBY' }));
    
    socket.on('game_state', (state) => set({ ...state }));
    
    socket.on('game_started', () => {
      set({ status: 'BATTLE' });
      toast('BATTLE STATIONS!', { icon: '⚔️', style: { background: '#ef4444', color: '#fff' } });
    });

    socket.on('effect_trigger', (data) => {
      set({ lastEffect: data });
      if (data.type === 'SHOT') {
        if (data.result === 'HIT') toast.success('TARGET HIT!', { icon: '💥' });
        if (data.result === 'BLOCKED_TERRAIN') toast.error('BLOCKED BY TERRAIN', { icon: '⛰️' });
        if (data.result === 'MISS') toast('SPLASH! Missed.', { icon: '🌊' });
      }
      if (data.type === 'SPY_REVEAL') {
        toast('WARNING: ENEMY SPY REVEALING MAP!', { icon: '👁️' });
      }
    });

    socket.on('game_over', (data) => {
      set({ status: 'ENDED', winner: data.winnerName });
      
      // [FIX]: Dùng chuỗi text thay vì JSX <div> để fix lỗi file .ts
      toast(`GAME OVER\nWinner: ${data.winnerName}\n${data.reason}`, {
        duration: 5000,
        icon: '🏁',
        style: { textAlign: 'center' }
      });
    });

    socket.on('room_log', (msg) => toast(msg, { position: 'bottom-left', style: { fontSize: '12px' } }));
    socket.on('error', (msg) => toast.error(msg));

    set({ socket });
  },

  // Actions Implementation
  createRoom: (name, roomId) => {
    get().socket?.emit('create_room', { name, roomId });
  },
  
  joinRoom: (name, roomId) => {
    get().socket?.emit('join_room', { name, roomId });
  },
  
  selectCommander: (commanderId) => {
    const { roomId } = get();
    if(roomId) get().socket?.emit('select_commander', { roomId, commanderId });
  },
  
  deployFleet: (ships) => {
    const { roomId } = get();
    if(roomId) get().socket?.emit('deploy_fleet', { roomId, ships });
  },
  
  buyItem: (itemId) => {
    const { roomId } = get();
    if(roomId) get().socket?.emit('buy_item', { roomId, itemId });
  },
  
  moveUnit: (unitId, x, y) => {
    const { roomId } = get();
    if(roomId) get().socket?.emit('move_unit', { roomId, unitId, x, y });
  },
  
  fireShot: (x, y, preferredUnitId) => {
    const { roomId } = get();
    if(roomId) get().socket?.emit('fire_shot', { roomId, x, y, preferredUnitId });
  },
  
  useItem: (itemId, params) => {
    const { roomId } = get();
    if(roomId) get().socket?.emit('use_item', { roomId, itemId, params });
  },
  
  activateSkill: () => {
    const { roomId } = get();
    if(roomId) get().socket?.emit('activate_skill', { roomId });
  },
  
  reset: () => set({ ...initialDataState, socket: null })
}));