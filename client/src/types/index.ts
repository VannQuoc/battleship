// client/src/types/index.ts

export type TerrainType = 0 | 1 | 2 | 3 | 4;

export interface CellData {
  x: number;
  y: number;
  hit: boolean; // Quan trọng: Để vẽ đốt tàu bị hỏng
}

export interface Unit {
  id: string;
  code: string; // CV, BB, DD...
  type: 'SHIP' | 'STRUCTURE';
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  vertical: boolean;
  cells: CellData[]; // Sync từ server
  isSunk: boolean;
  isImmobilized: boolean; // Hiệu ứng mỏ neo
  chargingTurns?: number; // Cho SILO
  revealedTurns?: number; // Cho hiệu ứng lộ diện
  ownerId: string;
}

export interface GameLog {
    turn?: number;
    action?: string;
    playerId?: string;
    attacker?: string;
    unit?: string;
    result?: string; // HIT, MISS, BLOCKED_TERRAIN, SUNK
    x?: number;
    y?: number;
    msg?: string;
}

export interface GameState {
  roomId: string | null;
  playerId: string | null;
  status: 'LOBBY' | 'SETUP' | 'BATTLE' | 'ENDED';
  turn: string | null;
  mapData: TerrainType[][];
  me: {
    points: number;
    fleet: Unit[];
    inventory: string[];
    commander: string;
    activeEffects: any;
  } | null;
  opponent: {
    name: string;
    fleet: Partial<Unit>[]; // Fleet địch chỉ hiện những con đã lộ
  } | null;
  logs: GameLog[];
  winner?: string;
}