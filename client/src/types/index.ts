export type TerrainType = 0 | 1 | 2 | 3 | 4;

export interface CellData {
  x: number;
  y: number;
  hit: boolean; 
}

export interface Unit {
  id: string;
  code: string;
  type: 'SHIP' | 'STRUCTURE';
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  vertical: boolean;
  cells: CellData[]; 
  isSunk: boolean;
  isImmobilized: boolean; 
  chargingTurns?: number; 
  revealedTurns?: number; 
  ownerId: string;
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
    activeEffects: { jammer: number; admiralVision: number };
    commanderUsed: boolean; // [FIX] Thêm dòng này
  } | null;
  opponent: {
    name: string;
    fleet: Unit[]; 
  } | null;
  logs: any[];
  winner?: string;
}