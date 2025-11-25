// client/src/types/index.ts

// ============================================================
// TERRAIN TYPES
// ============================================================
export type TerrainType = 0 | 1 | 2 | 3 | 4;

export const TERRAIN = {
  WATER: 0 as TerrainType,
  ISLAND: 1 as TerrainType,
  REEF: 2 as TerrainType,
  STORM: 3 as TerrainType,
  FOG: 4 as TerrainType,
} as const;

// ============================================================
// CELL & UNIT TYPES
// ============================================================
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
  isStealth?: boolean;
  alwaysVisible?: boolean;
  chargingTurns?: number;
  revealedTurns?: number;
  isRevealed?: boolean;
  turnCounter?: number;
  ownerId: string;
  vision?: number;
  moveRange?: number;
}

// ============================================================
// INVENTORY (New format: Object with counts)
// ============================================================
export type InventoryObject = Record<string, number>; // { 'NUKE': 2, 'DRONE': 3 }

// ============================================================
// PLAYER TYPES
// ============================================================
export interface ActiveEffects {
  jammer: number;
  admiralVision: number;
}

export interface Player {
  id: string;
  name?: string;
  points: number;
  fleet: Unit[];
  inventory: InventoryObject; // New: Object format
  inventoryArray?: string[]; // Legacy: Array format
  usedSlots: number;
  maxSlots: number;
  commander: string | null;
  commanderUsed: boolean;
  buildingDiscount?: number;
  activeEffects: ActiveEffects;
  ready?: boolean;
}

// Public player data (for lobby display)
export interface PublicPlayer {
  id: string;
  name: string;
  ready: boolean;
  commander: string | null;
  points: number;
  inventory: InventoryObject;
  inventoryArray?: string[];
  usedSlots: number;
  maxSlots: number;
  buildingDiscount: number;
}

export interface Opponent {
  id?: string;
  name: string;
  fleet: Unit[];
}

// ============================================================
// GAME STATE TYPES
// ============================================================
export type GameStatus = 'IDLE' | 'LOBBY' | 'SETUP' | 'BATTLE' | 'ENDED';

export interface GameConfig {
  mapSize: number;
  startingPoints: number;
  maxPlayers: number;
}

export interface LogEntry {
  turn?: number;
  action?: string;
  attacker?: string;
  unit?: string;
  x?: number;
  y?: number;
  result?: string;
  msg?: string;
  sunk?: string[];
  playerId?: string;
  itemId?: string;
  type?: string;
}

export interface GameState {
  status: GameStatus;
  mapData: TerrainType[][];
  turn: string | null;
  hostId: string | null;
  me: Player | null;
  opponent: Opponent | null;
  opponents?: Record<string, Opponent>;
  players?: Record<string, PublicPlayer>;
  logs: LogEntry[];
  config?: GameConfig;
}

// ============================================================
// LOBBY DATA (from lobby_update event)
// ============================================================
export interface LobbyData {
  roomId: string;
  status: GameStatus;
  hostId: string;
  config: GameConfig;
  players: Record<string, PublicPlayer>;
  mapData: TerrainType[][];
}

// ============================================================
// EFFECT TYPES
// ============================================================
export interface EffectTrigger {
  type: string;
  attackerId?: string;
  playerId?: string;
  x?: number;
  y?: number;
  result?: string;
  itemId?: string;
  unitId?: string;
  findings?: { type: string; x: number; y: number }[];
  hits?: { unitId: string; status: string }[];
  destroyed?: string[];
  msg?: string;
  revealedLocation?: { x: number; y: number };
  isRevealed?: boolean;
  amount?: number;
  sunk?: string[];
  gameEnded?: boolean;
  winner?: string;
}

// ============================================================
// DEPLOYMENT TYPES
// ============================================================
export interface ShipPlacement {
  code: string;
  x: number;
  y: number;
  vertical: boolean;
}

// ============================================================
// ITEM USE PARAMS
// ============================================================
export interface ItemUseParams {
  targetId?: string;
  unitId?: string;
  x?: number;
  y?: number;
  vertical?: boolean;
  axis?: 'row' | 'col';
  index?: number;
}

// ============================================================
// DEFINITION TYPES
// ============================================================
export interface UnitDefinition {
  code: string;
  name: string;
  size: number;
  type: 'SHIP' | 'STRUCTURE';
  hp: number;
  vision: number;
  move?: number;
  cost: number;
  desc?: string;
  range?: number;
  rangeFactor?: number;
  trajectory?: 'DIRECT' | 'ARC';
  isStealth?: boolean;
  hasSonar?: boolean;
  alwaysVisible?: boolean;
  canAttackSurface?: boolean;
  canAttackAir?: boolean;
  passive?: string;
  isSilo?: boolean;
  damage?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  type: 'PASSIVE' | 'ACTIVE' | 'SKILL';
  cost: number;
  desc?: string;
  counter?: string;
  turns?: number;
  reqSilo?: boolean;
}

export interface CommanderDefinition {
  id: string;
  name: string;
  desc: string;
  skill: string;
  passive?: string;
}
