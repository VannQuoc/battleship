// client/src/config/constants.ts

export const TERRAIN = {
  WATER: 0,
  ISLAND: 1, // Chặn di chuyển, chặn đạn bắn thẳng
  REEF: 2,   // Chặn tàu to (Size >= 4) và Submarine
  STORM: 3,  // (Future) Chặn máy bay
  FOG: 4     // (Future) Giảm vision
};

export const CONSTANTS = {
  DEFAULT_MAP_SIZE: 30,
  NUKE_RADIUS: 7, // 7x7 hoặc bán kính 7 tùy logic server (Server code dùng radius Chebyshev)
  MAX_ITEMS: 6,
  CRITICAL_THRESHOLD: 0.5,
};

export const UNIT_DEFINITIONS: Record<string, any> = {
  // --- SHIPS ---
  CV: { code: 'CV', name: 'Carrier', size: 5, type: 'SHIP', range: 999, vision: 4, move: 2, desc: 'Global Range' },
  BB: { code: 'BB', name: 'Battleship', size: 4, type: 'SHIP', rangeFactor: 0.8, vision: 5, move: 3, desc: 'Long Range' },
  CL: { code: 'CL', name: 'Cruiser', size: 3, type: 'SHIP', range: 6, antiAir: true, vision: 6, move: 4, desc: 'Anti-Air' },
  DD: { code: 'DD', name: 'Destroyer', size: 2, type: 'SHIP', range: 5, trajectory: 'DIRECT', hasSonar: true, vision: 7, move: 5, desc: 'Direct Fire & Sonar' },
  SS: { code: 'SS', name: 'Submarine', size: 3, type: 'SHIP', range: 4, stealth: true, vision: 3, move: 3, desc: 'Stealth' },
  
  // --- STRUCTURES ---
  LIGHTHOUSE: { code: 'LIGHTHOUSE', name: 'Hải Đăng', size: 2, type: 'STRUCTURE', vision: 8, cost: 300 },
  SUPPLY: { code: 'SUPPLY', name: 'Trạm Tiếp Tế', size: 3, type: 'STRUCTURE', vision: 2, cost: 400, desc: 'Heals nearby units' },
  SILO: { code: 'SILO', name: 'Bệ Phóng HN', size: 3, type: 'STRUCTURE', isSilo: true, vision: 2, cost: 1000, desc: 'Launches Nukes (5 turns charge)', alwaysVisible: true },
  AIRFIELD: { code: 'AIRFIELD', name: 'Sân Bay', size: 4, type: 'STRUCTURE', vision: 4, cost: 600, desc: 'Generates Drones', alwaysVisible: true },
  NUCLEAR_PLANT: { code: 'NUCLEAR_PLANT', name: 'Nhà Máy HN', size: 4, type: 'STRUCTURE', vision: 2, cost: 1500, desc: 'Generates Nukes', alwaysVisible: true }
};

export const ITEMS: Record<string, any> = {
    REPAIR_KIT: { name: 'Bộ Sửa Chữa', type: 'ACTIVE', desc: 'Hồi 20% HP' },
    DRONE: { name: 'Drone', type: 'ACTIVE', desc: 'Quét 1 hàng/cột' },
    MERCENARY: { name: 'Lính Đánh Thuê', type: 'ACTIVE', desc: 'Ám sát sau 3 lượt' },
    SUICIDE_SQUAD: { name: 'Lính Cảm Tử', type: 'ACTIVE', desc: 'Nổ 3x3 dmg' },
    BLACK_HAT: { name: 'Hacker Đen', type: 'ACTIVE', desc: 'Hack công trình địch' },
    ENGINE_BOOST: { name: 'Động Cơ Phụ', type: 'ACTIVE', desc: 'Teleport 5 ô' },
    JAMMER: { name: 'Phá Sóng', type: 'ACTIVE', desc: 'Gây nhiễu địch 3 lượt' },
    DECOY: { name: 'Xuồng Cứu Hộ', type: 'ACTIVE', desc: 'Tạo tàu giả' },
    NUKE: { name: 'Đầu Đạn HN', type: 'ACTIVE', desc: 'Nổ diện rộng (Cần SILO)' },
    ANTI_AIR: { name: 'Tên lửa PK', type: 'PASSIVE', desc: 'Chặn máy bay/Drone' },
    FLARES: { name: 'Bẫy Nhiệt', type: 'PASSIVE', desc: 'Chặn tên lửa' },
    WHITE_HAT: { name: 'Mũ Trắng', type: 'PASSIVE', desc: 'Chặn Hacker' },
};

export const COMMANDERS = [
  { id: 'ADMIRAL', name: 'Admiral', desc: 'Fleet Vision +2', skill: 'Buff Vision' },
  { id: 'SPY', name: 'The Spy', desc: 'Submarine Move +2', skill: 'Reveal Map (3s)' },
  { id: 'ENGINEER', name: 'Engineer', desc: 'Building Cost -20%', skill: 'Instant Repair' },
];