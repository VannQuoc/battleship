// server/src/config/definitions.js

module.exports = {
  CONSTANTS: {
    DEFAULT_MAP_SIZE: 30, // Nâng mặc định lên 30 cho rộng
    DEFAULT_POINTS: 3000,
    MAX_ITEMS: 6,
    CRITICAL_THRESHOLD: 0.5,
    SUICIDE_DAMAGE: 5,
    NUKE_RADIUS: 7,
  },

  // V2.0: ĐỊNH NGHĨA ĐỊA HÌNH
  TERRAIN: {
    WATER: 0,
    ISLAND: 1, // Chặn tất cả
    REEF: 2,   // Chặn tàu to (Size >= 4) và SS
    STORM: 3,  // Chặn máy bay (Future feature)
    FOG: 4     // Giảm vision
  },

  UNITS: {
    // --- V2.0: UNIT ROLES UPDATE ---
    
    // 1. SIZE 5: GLOBAL THREAT (CV)
    CV: { 
      code: 'CV', name: 'Carrier', size: 5, hp: 10, vision: 4, move: 2, cost: 0, 
      type: 'SHIP', 
      range: -1, // -1 = Infinite
      desc: 'Bắn toàn bản đồ' 
    },

    // 2. SIZE 4: ARTILLERY (BB)
    BB: { 
      code: 'BB', name: 'Battleship', size: 4, hp: 8, vision: 5, move: 3, cost: 0, 
      type: 'SHIP', 
      rangeFactor: 0.8, // 80% Map Size
      desc: 'Tầm xa, Damage to' 
    },

    // 3. SIZE 3: ANTI-AIR SUPPORT (CL)
    CL: { 
      code: 'CL', name: 'Cruiser', size: 3, hp: 6, vision: 6, move: 4, cost: 0, 
      type: 'SHIP', 
      canAttackSurface: false, // V2.0: Không bắn được tàu mặt nước
      canAttackAir: true,
      desc: 'Chuyên phòng không, không bắn được tàu' 
    },

    // 4. SIZE 2: DIRECT FIRE GLASS CANNON (DD)
    DD: { 
      code: 'DD', name: 'Destroyer', size: 2, hp: 4, vision: 7, move: 5, cost: 0, 
      type: 'SHIP', 
      hasSonar: true, 
      damage: 2, // V2.0: Damage to
      trajectory: 'DIRECT', // V2.0: Bắn thẳng (Bị chặn bởi đảo)
      desc: 'Damage to, bắn thẳng, có Sonar' 
    },

    // 5. SUBMARINE
    SS: { 
      code: 'SS', name: 'Submarine', size: 3, hp: 5, vision: 3, move: 3, cost: 0, 
      type: 'SHIP', 
      isStealth: true,
      desc: 'Tàng hình, đi xuyên Storm'
    },

    // --- V2.0: STRUCTURES VISIBILITY ---
    LIGHTHOUSE: { code: 'LIGHTHOUSE', name: 'Hải Đăng', size: 2, hp: 5, vision: 8, cost: 300, type: 'STRUCTURE' },
    SUPPLY: { code: 'SUPPLY', name: 'Trạm Tiếp Tế', size: 3, hp: 6, vision: 2, cost: 400, type: 'STRUCTURE', passive: 'HEAL_AOE' },
    
    // Always Visible Structures
    SILO: { code: 'SILO', name: 'Bệ Phóng HN', size: 3, hp: 10, vision: 2, cost: 1000, type: 'STRUCTURE', isSilo: true, alwaysVisible: true },
    AIRFIELD: { code: 'AIRFIELD', name: 'Sân Bay', size: 4, hp: 8, vision: 4, cost: 600, type: 'STRUCTURE', passive: 'SPAWN_PLANE', alwaysVisible: true },
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