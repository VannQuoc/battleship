// D:\New folder\battleship\client\src\types.ts

// Định nghĩa các loại địa hình (dựa trên server/config/definitions.js)
export type TerrainType = 0 | 1 | 2 | 3 | 4; 
// 0: Water, 1: Island, 2: Reef, 3: Storm, 4: Fog

// Định nghĩa từng đốt (cell) của con tàu
export interface UnitCell {
  x: number;
  y: number;
  hit: boolean; // true nếu đốt này đã bị bắn trúng
}

// Định nghĩa đối tượng Unit (Tàu hoặc Công trình)
// Map với server/src/models/Unit.js
export interface Unit {
  id: string;
  code: string; // Ví dụ: 'CV', 'BB', 'DD', 'SILO'...
  type: 'SHIP' | 'STRUCTURE';
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  vertical: boolean;
  cells: UnitCell[];
  isSunk: boolean;
  isImmobilized: boolean; // Bị đứt xích/hỏng động cơ
  isStealth?: boolean;    // Tàu ngầm
  revealedTurns?: number; // Đang bị lộ diện
  chargingTurns?: number; // Cho SILO nạp đạn
  ownerId?: string;
  definition?: any;       // Thông số gốc (tầm bắn, vision...)
}

// Trạng thái của chính mình (Player)
// Map với server/src/models/Player.js
export interface PlayerState {
  points: number;
  fleet: Unit[];        // Danh sách tàu của mình
  inventory: string[];  // Kho đồ (Item ID)
  activeEffects: {
    jammer: number;
    admiralVision: number;
  };
  commander: string | null;
}

// Trạng thái của đối thủ (chỉ chứa thông tin server cho phép thấy)
export interface OpponentState {
  name: string;
  fleet: Partial<Unit>[]; // Mảng tàu địch (có thể thiếu thông tin nếu chưa lộ)
}

// Trạng thái toàn cục của Game (State tổng)
// Dùng để đồng bộ với hàm getStateFor() bên server
export interface GameState {
  roomId: string | null;
  status: 'LOBBY' | 'SETUP' | 'BATTLE' | 'ENDED';
  turn: string | null;    // ID người đang có lượt
  mapData: number[][];    // Mảng 2 chiều địa hình (0,1,2...)
  me: PlayerState;
  opponent: OpponentState;
  logs: any[];            // Nhật ký trận đấu
  winner?: string;
}