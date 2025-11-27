// client/src/config/constants.ts
// Now loads from API via ConfigContext
// Fallback values are provided for initial render

import type { UnitDefinition, ItemDefinition, CommanderDefinition } from '../types';

// ============================================================
// FALLBACK CONSTANTS (used before config loads)
// ============================================================
export const CONSTANTS_FALLBACK = {
  DEFAULT_MAP_SIZE: 30,
  DEFAULT_POINTS: 3000,
  MAX_SLOTS: 10,
  MAX_PLAYERS: 10,
  MIN_PLAYERS: 2,
  CRITICAL_THRESHOLD: 0.5,
  SUICIDE_DAMAGE: 5,
  NUKE_RADIUS: 7,
  ENGINEER_DISCOUNT: 0.2,
  SILO_CHARGE_TURNS: 5,
  AIRFIELD_SPAWN_TURNS: 3,
  NUCLEAR_PLANT_SPAWN_TURNS: 10,
  MAP_SIZE_BASE: 20,
  MAP_SIZE_PER_PLAYER: 5,
  RADAR_RANGE: 2,
  WHITE_HAT_RANGE: 2,
  WHITE_HAT_TURNS: 3,
  JAMMER_DISRUPT_RANGE: 2,
} as const;

// Export fallback as default for backward compatibility
export const CONSTANTS = CONSTANTS_FALLBACK;

// ============================================================
// TERRAIN TYPES (static)
// ============================================================
export const TERRAIN = {
  WATER: 0,
  ISLAND: 1,
  REEF: 2,
  STORM: 3,
  FOG: 4,
} as const;

// ============================================================
// FALLBACK UNIT DEFINITIONS
// ============================================================
export const UNIT_DEFINITIONS_FALLBACK: Record<string, UnitDefinition> = {
  CV: {
    code: 'CV',
    name: 'Carrier',
    size: 5,
    hp: 10,
    vision: 4,
    move: 2,
    cost: 0,
    type: 'SHIP',
    range: -1,
    desc: 'Tàu sân bay - Bắn toàn bản đồ',
  },
  BB: {
    code: 'BB',
    name: 'Battleship',
    size: 4,
    hp: 8,
    vision: 5,
    move: 3,
    cost: 0,
    type: 'SHIP',
    rangeFactor: 0.8,
    desc: 'Thiết giáp hạm - Tầm xa, Damage cao',
  },
  CL: {
    code: 'CL',
    name: 'Cruiser',
    size: 3,
    hp: 6,
    vision: 6,
    move: 4,
    cost: 0,
    type: 'SHIP',
    canAttackSurface: false,
    canAttackAir: true,
    desc: 'Tuần dương hạm - Phòng không, không bắn tàu',
  },
  DD: {
    code: 'DD',
    name: 'Destroyer',
    size: 2,
    hp: 4,
    vision: 7,
    move: 5,
    cost: 0,
    type: 'SHIP',
    trajectory: 'DIRECT',
    hasSonar: true,
    damage: 2,
    desc: 'Khu trục hạm - Bắn thẳng, Sonar tìm tàu ngầm',
  },
  SS: {
    code: 'SS',
    name: 'Submarine',
    size: 3,
    hp: 5,
    vision: 3,
    move: 3,
    cost: 0,
    type: 'SHIP',
    isStealth: true,
    desc: 'Tàu ngầm - Tàng hình, không đi qua Reef',
  },
  LIGHTHOUSE: {
    code: 'LIGHTHOUSE',
    name: 'Hải Đăng',
    size: 2,
    hp: 5,
    vision: 8,
    cost: 300,
    type: 'STRUCTURE',
    desc: 'Tầm nhìn siêu rộng (8 ô)',
  },
  SUPPLY: {
    code: 'SUPPLY',
    name: 'Trạm Tiếp Tế',
    size: 3,
    hp: 6,
    vision: 2,
    cost: 400,
    type: 'STRUCTURE',
    passive: 'HEAL_AOE',
    desc: 'Hồi 5 HP cho đồng minh trong 3x3 mỗi lượt',
  },
  SILO: {
    code: 'SILO',
    name: 'Bệ Phóng HN',
    size: 3,
    hp: 10,
    vision: 2,
    cost: 1000,
    type: 'STRUCTURE',
    isSilo: true,
    alwaysVisible: true,
    desc: 'Always Visible - Nạp 5 lượt để bắn NUKE',
  },
  AIRFIELD: {
    code: 'AIRFIELD',
    name: 'Sân Bay',
    size: 4,
    hp: 8,
    vision: 4,
    cost: 600,
    type: 'STRUCTURE',
    passive: 'SPAWN_PLANE',
    alwaysVisible: true,
    desc: 'Always Visible - Tặng DRONE mỗi 3 lượt',
  },
  NUCLEAR_PLANT: {
    code: 'NUCLEAR_PLANT',
    name: 'Nhà Máy HN',
    size: 4,
    hp: 8,
    vision: 2,
    cost: 1500,
    type: 'STRUCTURE',
    passive: 'GEN_NUKE',
    alwaysVisible: true,
    desc: 'Always Visible - Tặng NUKE mỗi 10 lượt',
  },
};

// Export fallback as default for backward compatibility
export const UNIT_DEFINITIONS = UNIT_DEFINITIONS_FALLBACK;

// ============================================================
// FALLBACK ITEM DEFINITIONS
// ============================================================
export const ITEMS_FALLBACK: Record<string, ItemDefinition> = {
  ANTI_AIR: {
    id: 'ANTI_AIR',
    name: 'Tên Lửa Phòng Không',
    type: 'PASSIVE',
    cost: 200,
    counter: 'AIR',
    desc: 'Tự động bắn hạ DRONE của địch khi bị quét',
  },
  FLARES: {
    id: 'FLARES',
    name: 'Bẫy Nhiệt',
    type: 'PASSIVE',
    cost: 150,
    counter: 'MISSILE',
    desc: 'Chặn skill dạng tên lửa (Future)',
  },
  WHITE_HAT: {
    id: 'WHITE_HAT',
    name: 'Hacker Mũ Trắng',
    type: 'ACTIVE',
    cost: 300,
    desc: 'Đặt White Hat tại ô để chặn Hacker Đen trong 3 lượt',
  },
  REPAIR_KIT: {
    id: 'REPAIR_KIT',
    name: 'Bộ Sửa Chữa',
    type: 'ACTIVE',
    cost: 200,
    desc: 'Hồi 20% HP cho 1 tàu & sửa động cơ',
  },
  DRONE: {
    id: 'DRONE',
    name: 'Drone Trinh Sát',
    type: 'ACTIVE',
    cost: 150,
    desc: 'Quét 1 hàng hoặc 1 cột để tìm địch',
  },
  ENGINE_BOOST: {
    id: 'ENGINE_BOOST',
    name: 'Động Cơ Phụ',
    type: 'ACTIVE',
    cost: 200,
    desc: 'Teleport 1 tàu trong phạm vi 5 ô (Bị lộ)',
  },
  DECOY: {
    id: 'DECOY',
    name: 'Xuồng Cứu Hộ (Mồi nhử)',
    type: 'ACTIVE',
    cost: 100,
    desc: 'Tạo tàu giả để đánh lừa địch',
  },
  JAMMER: {
    id: 'JAMMER',
    name: 'Thiết Bị Phá Sóng',
    type: 'ACTIVE',
    cost: 400,
    desc: 'Gắn lên tàu/công trình để phá sóng radar đối phương (3 lượt)',
  },
  RADAR: {
    id: 'RADAR',
    name: 'Radar Đồn Đáp',
    type: 'ACTIVE',
    cost: 500,
    desc: 'Gắn lên tàu/công trình để phát hiện tàu ngầm trong vùng 5x5',
  },
  MERCENARY: {
    id: 'MERCENARY',
    name: 'Lính Đánh Thuê',
    type: 'ACTIVE',
    cost: 500,
    turns: 3,
    desc: 'Ám sát 1 tàu địch đã lộ sau 3 lượt',
  },
  SUICIDE_SQUAD: {
    id: 'SUICIDE_SQUAD',
    name: 'Lính Cảm Tử',
    type: 'ACTIVE',
    cost: 300,
    desc: 'Ném lính tới ô bất kỳ, nổ 3x3 (3 DMG)',
  },
  BLACK_HAT: {
    id: 'BLACK_HAT',
    name: 'Hacker Mũ Đen',
    type: 'ACTIVE',
    cost: 600,
    desc: 'Chiếm quyền điều khiển công trình địch',
  },
  NUKE: {
    id: 'NUKE',
    name: 'Đầu Đạn Hạt Nhân',
    type: 'ACTIVE',
    cost: 2000,
    reqSilo: true,
    desc: 'BK 7 (~15x15) - Hủy diệt tất cả (cần SILO)',
  },
  SELF_DESTRUCT: {
    id: 'SELF_DESTRUCT',
    name: 'Tự Hủy (Skill)',
    type: 'SKILL',
    cost: 0,
    desc: 'Kích hoạt khi HP < 50% - Nổ 3x3 (5 DMG)',
  },
};

// Export fallback as default for backward compatibility
export const ITEMS = ITEMS_FALLBACK;

// ============================================================
// COMMANDER DEFINITIONS (static)
// ============================================================
export const COMMANDERS: CommanderDefinition[] = [
  {
    id: 'ADMIRAL',
    name: 'Đô Đốc',
    desc: 'Tàu chiến +20% HP',
    skill: 'Tăng Vision +2 trong 2 lượt',
    passive: 'Ships HP +20%',
  },
  {
    id: 'SPY',
    name: 'Điệp Viên',
    desc: 'Tàu ngầm +2 Move',
    skill: 'Lộ toàn bộ bản đồ địch (3 giây)',
    passive: 'Submarine Move +2',
  },
  {
    id: 'ENGINEER',
    name: 'Kỹ Sư',
    desc: 'Giá công trình -20%',
    skill: 'Hồi full HP 1 đơn vị bất kỳ',
    passive: 'Structure cost -20%',
  },
];

// ============================================================
// HOOKS TO GET CONFIG FROM CONTEXT (for dynamic values)
// ============================================================
export { useConfig } from '../contexts/ConfigContext';

export function useConstants() {
  const { config } = useConfig();
  return config?.constants || CONSTANTS_FALLBACK;
}

export function useUnitDefinitions() {
  const { config } = useConfig();
  return config?.units || UNIT_DEFINITIONS_FALLBACK;
}

export function useItemDefinitions() {
  const { config } = useConfig();
  return config?.items || ITEMS_FALLBACK;
}

// ============================================================
// HELPER FUNCTIONS (use fallback values)
// ============================================================
export function getUnitDefinition(code: string): UnitDefinition | undefined {
  return UNIT_DEFINITIONS_FALLBACK[code];
}

export function getItemDefinition(id: string): ItemDefinition | undefined {
  return ITEMS_FALLBACK[id];
}

export function isStructure(code: string): boolean {
  return UNIT_DEFINITIONS_FALLBACK[code]?.type === 'STRUCTURE';
}

export function isShip(code: string): boolean {
  return UNIT_DEFINITIONS_FALLBACK[code]?.type === 'SHIP';
}

export function getStructures(): UnitDefinition[] {
  return Object.values(UNIT_DEFINITIONS_FALLBACK).filter((u) => u.type === 'STRUCTURE');
}

export function getShips(): UnitDefinition[] {
  return Object.values(UNIT_DEFINITIONS_FALLBACK).filter((u) => u.type === 'SHIP');
}

export function getActiveItems(): ItemDefinition[] {
  return Object.values(ITEMS_FALLBACK).filter((i) => i.type === 'ACTIVE');
}

export function getPassiveItems(): ItemDefinition[] {
  return Object.values(ITEMS_FALLBACK).filter((i) => i.type === 'PASSIVE');
}

export function getPurchasableItems(): ItemDefinition[] {
  return Object.values(ITEMS_FALLBACK).filter((i) => i.type !== 'SKILL');
}

export function calculatePrice(code: string, discount: number = 0): number {
  const def = UNIT_DEFINITIONS_FALLBACK[code] || ITEMS_FALLBACK[code];
  if (!def) return 0;
  return Math.floor(def.cost * (1 - discount));
}

export function getItemName(id: string): string {
  return ITEMS_FALLBACK[id]?.name || UNIT_DEFINITIONS_FALLBACK[id]?.name || id;
}
