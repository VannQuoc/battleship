module.exports = {
  CONSTANTS: {
    MAP_SIZE_DEFAULT: 20,
    MAX_PLAYERS: 2,
    STARTING_POINTS: 2000,
    POINTS_PER_HIT: 50,
    POINTS_PER_KILL: 200,
    TURN_TIME_LIMIT: 60, // seconds
    CRITICAL_THRESHOLD: 0.5 // < 50% HP
  },

  // Milestone 2 & 4: Danh sách Tàu & Công trình
  UNITS: {
    // TÀU (Có thể di chuyển)
    CV: { code: 'CV', name: 'Carrier', size: 5, hp: 10, vision: 4, cost: 0, type: 'SHIP' },
    BB: { code: 'BB', name: 'Battleship', size: 4, hp: 8, vision: 5, cost: 0, type: 'SHIP' },
    CL: { code: 'CL', name: 'Cruiser', size: 3, hp: 6, vision: 6, cost: 0, type: 'SHIP' },
    SS: { code: 'SS', name: 'Submarine', size: 3, hp: 5, vision: 3, cost: 0, type: 'SHIP', isStealth: true },
    DD: { code: 'DD', name: 'Destroyer', size: 2, hp: 4, vision: 7, cost: 0, type: 'SHIP', hasSonar: true },

    // CÔNG TRÌNH (Đứng yên)
    LIGHTHOUSE: { code: 'LIGHTHOUSE', name: 'Hải Đăng', size: 2, hp: 5, vision: 8, cost: 300, type: 'STRUCTURE' },
    SUPPLY: { code: 'SUPPLY', name: 'Trạm Tiếp Tế', size: 3, hp: 6, vision: 2, cost: 400, type: 'STRUCTURE', passive: 'HEAL_AOE' },
    SILO: { code: 'SILO', name: 'Bệ Phóng HN', size: 3, hp: 10, vision: 2, cost: 1000, type: 'STRUCTURE', isSilo: true },
    NUCLEAR_PLANT: { code: 'NUCLEAR_PLANT', name: 'Nhà Máy HN', size: 4, hp: 8, vision: 2, cost: 1500, type: 'STRUCTURE', passive: 'GEN_NUKE' }
  },

  // Milestone 4: Items & Skills
  ITEMS: {
    // Passive (Tự kích hoạt khi bị bắn)
    ANTI_AIR: { id: 'ANTI_AIR', name: 'Tên lửa PK', type: 'PASSIVE', cost: 200, counter: 'AERIAL' },
    FLARES: { id: 'FLARES', name: 'Bẫy Nhiệt', type: 'PASSIVE', cost: 150, counter: 'MISSILE' },
    
    // Active (Người chơi kích hoạt)
    REPAIR_KIT: { id: 'REPAIR_KIT', name: 'Bộ Sửa Chữa', type: 'ACTIVE', cost: 200, effect: 'HEAL' },
    DRONE: { id: 'DRONE', name: 'Drone', type: 'ACTIVE', cost: 150, effect: 'SCAN_LINE' },
    NUKE: { id: 'NUKE', name: 'Đầu đạn HN', type: 'ACTIVE', cost: 2000, effect: 'AOE_DAMAGE', reqSilo: true },
    JAMMER: { id: 'JAMMER', name: 'Phá Sóng', type: 'ACTIVE', cost: 400, effect: 'HIDE_FLEET' }
  },

  COMMANDERS: {
    ADMIRAL: { id: 'ADMIRAL', name: 'The Admiral', desc: '+20% HP' },
    SPY: { id: 'SPY', name: 'The Spy', desc: 'Submarine +2 Move' },
    ENGINEER: { id: 'ENGINEER', name: 'The Engineer', desc: 'Structure -20% Cost' }
  }
};