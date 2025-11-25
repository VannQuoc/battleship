// client\src\types\index.ts

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

// --- THÊM CÁC INTERFACE MỚI ĐỂ EXPORT ---

/**
 * Interface cho dữ liệu Người chơi Hiện tại (Me)
 * Gần như tương đương với Unit.me trong GameState cũ
 */
export interface Player {
    points: number;
    fleet: Unit[];
    inventory: string[];
    commander: string;
    activeEffects: { jammer: number; admiralVision: number };
    commanderUsed: boolean;
    username: string; // Thêm username để nhất quán với opponent
    id: string; // Thêm id để nhất quán
}

/**
 * Interface cho dữ liệu Đối thủ (Opponent)
 * Gần như tương đương với Unit.opponent trong GameState cũ
 */
export interface Opponent {
    name: string;
    fleet: Unit[]; 
}

// --- CẬP NHẬT GAMESTATE ĐỂ SỬ DỤNG CÁC INTERFACE MỚI ---

export interface GameState {
    roomId: string | null;
    playerId: string | null;
    status: 'LOBBY' | 'SETUP' | 'BATTLE' | 'ENDED';
    turn: string | null;
    mapData: TerrainType[][];
    
    // Sử dụng interface Player mới
    me: Player & {
        // me có thể chứa các trường khác của GameState.me ban đầu
        // Đảm bảo các trường của Player được map chính xác
        commanderUsed: boolean; // [FIX] Dòng này đã được chuyển vào Player, có thể xóa ở đây nếu Player được định nghĩa đầy đủ
    } | null;

    // Sử dụng interface Opponent mới
    opponent: Opponent | null; 
    
    logs: any[];
    winner?: string;
}