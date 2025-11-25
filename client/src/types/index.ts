export type TerrainType = 0 | 1 | 2 | 3 | 4; // Water, Island, Reef, Storm, Fog

export interface CellData {
  x: number;
  y: number;
  hit: boolean;
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
  cells: CellData[];
  isSunk: boolean;
  isImmobilized: boolean;
  chargingTurns?: number; // Cho SILO
  revealedTurns?: number; // Cho hiệu ứng lộ diện
  definition?: any; // Config gốc từ definitions.js
}

export interface PlayerState {
  points: number;
  fleet: Unit[];
  inventory: string[];
  activeEffects: {
    jammer: number;
    admiralVision: number;
  };
}

export interface OpponentState {
  name: string;
  fleet: Partial<Unit>[]; // Chỉ chứa unit đã lộ diện
}

export interface GameState {
  roomId: string | null;
  playerId: string | null;
  status: 'LOBBY' | 'SETUP' | 'BATTLE' | 'ENDED';
  turn: string | null; // PlayerID của lượt hiện tại
  mapData: TerrainType[][];
  me: PlayerState | null;
  opponent: OpponentState | null;
  logs: any[];
  winner?: string;
}