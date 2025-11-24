// server/src/config/definitions.js
module.exports = {
  CONSTANTS: {
    // Default values (fallback)
    DEFAULT_MAP_SIZE: 20,
    DEFAULT_POINTS: 2000,
    DEFAULT_PLAYERS: 2,
    
    CRITICAL_THRESHOLD: 0.5,
    SUICIDE_DAMAGE: 5, // Damage khi tàu <50% tự nổ
    EXPLOSION_RADIUS: 1, // 3x3
    NUKE_RADIUS: 7, // 15x15
  },

  UNITS: {
    // --- SHIPS ---
    CV: { code: 'CV', name: 'Carrier', size: 5, hp: 10, vision: 4, move: 2, cost: 0, type: 'SHIP' },
    BB: { code: 'BB', name: 'Battleship', size: 4, hp: 8, vision: 5, move: 3, cost: 0, type: 'SHIP' },
    CL: { code: 'CL', name: 'Cruiser', size: 3, hp: 6, vision: 6, move: 4, cost: 0, type: 'SHIP' },
    SS: { code: 'SS', name: 'Submarine', size: 3, hp: 5, vision: 3, move: 3, cost: 0, type: 'SHIP', isStealth: true },
    DD: { code: 'DD', name: 'Destroyer', size: 2, hp: 4, vision: 7, move: 5, cost: 0, type: 'SHIP', hasSonar: true },
    
    // --- SPECIAL UNITS ---
    DECOY_UNIT: { code: 'DECOY_UNIT', name: 'Decoy', size: 2, hp: 1, vision: 0, move: 0, cost: 0, type: 'FAKE' },

    // --- STRUCTURES ---
    LIGHTHOUSE: { code: 'LIGHTHOUSE', name: 'Hải Đăng', size: 2, hp: 5, vision: 8, cost: 300, type: 'STRUCTURE' },
    SUPPLY: { code: 'SUPPLY', name: 'Trạm Tiếp Tế', size: 3, hp: 6, vision: 2, cost: 400, type: 'STRUCTURE', passive: 'HEAL_AOE' },
    SILO: { code: 'SILO', name: 'Bệ Phóng HN', size: 3, hp: 10, vision: 2, cost: 1000, type: 'STRUCTURE', isSilo: true },
    AIRFIELD: { code: 'AIRFIELD', name: 'Sân Bay', size: 4, hp: 8, vision: 4, cost: 600, type: 'STRUCTURE', passive: 'SPAWN_PLANE' },
    NUCLEAR_PLANT: { code: 'NUCLEAR_PLANT', name: 'Nhà Máy HN', size: 4, hp: 8, vision: 2, cost: 1500, type: 'STRUCTURE', passive: 'GEN_NUKE', alwaysVisible: true }
  },

  ITEMS: {
    // --- PASSIVE ---
    ANTI_AIR: { id: 'ANTI_AIR', name: 'Tên lửa PK', type: 'PASSIVE', cost: 200, counter: 'AIR' },
    FLARES: { id: 'FLARES', name: 'Bẫy Nhiệt', type: 'PASSIVE', cost: 150, counter: 'MISSILE' },
    WHITE_HAT: { id: 'WHITE_HAT', name: 'Hacker Mũ Trắng', type: 'PASSIVE', cost: 300, counter: 'HACK' },

    // --- ACTIVE ---
    REPAIR_KIT: { id: 'REPAIR_KIT', name: 'Bộ Sửa Chữa', type: 'ACTIVE', cost: 200 },
    DRONE: { id: 'DRONE', name: 'Drone', type: 'ACTIVE', cost: 150 },
    MERCENARY: { id: 'MERCENARY', name: 'Lính Đánh Thuê', type: 'ACTIVE', cost: 500, turns: 3 },
    SUICIDE_SQUAD: { id: 'SUICIDE_SQUAD', name: 'Lính Cảm Tử', type: 'ACTIVE', cost: 300 },
    BLACK_HAT: { id: 'BLACK_HAT', name: 'Hacker Đen', type: 'ACTIVE', cost: 600 },
    ENGINE_BOOST: { id: 'ENGINE_BOOST', name: 'Động Cơ Phụ', type: 'ACTIVE', cost: 200 },
    JAMMER: { id: 'JAMMER', name: 'Phá Sóng', type: 'ACTIVE', cost: 400 },
    DECOY: { id: 'DECOY', name: 'Xuồng Cứu Hộ', type: 'ACTIVE', cost: 100 },
    NUKE: { id: 'NUKE', name: 'Đầu đạn HN', type: 'ACTIVE', cost: 2000, reqSilo: true },
    
    // --- SKILL UNLOCK ---
    SELF_DESTRUCT: { id: 'SELF_DESTRUCT', name: 'Cảm Tử (Skill)', type: 'SKILL', cost: 0 } // Mở khi < 50% HP
  }
};