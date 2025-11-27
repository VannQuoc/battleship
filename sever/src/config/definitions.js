// server/src/config/definitions.js
// This file now uses configLoader to read from shared/gameConfig.json
// Provides backward-compatible exports

const configLoader = require('./configLoader');

// Static fallback definitions (defined first for reference)
const STATIC_DEFINITIONS = {
  CONSTANTS_STATIC: {
    DEFAULT_MAP_SIZE: 30,
    DEFAULT_POINTS: 3000,
    MAX_SLOTS: 10,
    MAX_PLAYERS: 10,
    MIN_PLAYERS: 2,
    CRITICAL_THRESHOLD: 0.5,
    SUICIDE_DAMAGE: 5,
    NUKE_RADIUS: 7,
    ENGINEER_DISCOUNT: 0.2,
    MAP_SIZE_BASE: 20,
    MAP_SIZE_PER_PLAYER: 5,
    RADAR_RANGE: 2,
    WHITE_HAT_RANGE: 2,
    WHITE_HAT_TURNS: 3,
    JAMMER_DISRUPT_RANGE: 2,
  },

  TERRAIN_STATIC: {
    WATER: 0,
    ISLAND: 1,
    REEF: 2,
    STORM: 3,
    FOG: 4
  },

  UNITS_STATIC: {
    // --- SHIPS ---
    CV: { 
      code: 'CV', name: 'Carrier', size: 5, hp: 10, vision: 4, move: 2, cost: 0, 
      type: 'SHIP', 
      range: -1,
      desc: 'Bắn toàn bản đồ' 
    },
    BB: { 
      code: 'BB', name: 'Battleship', size: 4, hp: 8, vision: 5, move: 3, cost: 0, 
      type: 'SHIP', 
      rangeFactor: 0.8,
      desc: 'Tầm xa, Damage to' 
    },
    CL: { 
      code: 'CL', name: 'Cruiser', size: 3, hp: 6, vision: 6, move: 4, cost: 0, 
      type: 'SHIP', 
      canAttackSurface: false,
      canAttackAir: true,
      desc: 'Chuyên phòng không, không bắn được tàu' 
    },
    DD: { 
      code: 'DD', name: 'Destroyer', size: 2, hp: 4, vision: 7, move: 5, cost: 0, 
      type: 'SHIP', 
      hasSonar: true, 
      damage: 2,
      trajectory: 'DIRECT',
      desc: 'Damage to, bắn thẳng, có Sonar' 
    },
    SS: { 
      code: 'SS', name: 'Submarine', size: 3, hp: 5, vision: 3, move: 3, cost: 0, 
      type: 'SHIP', 
      isStealth: true,
      desc: 'Tàng hình, đi xuyên Storm'
    },

    // --- STRUCTURES ---
    LIGHTHOUSE: { code: 'LIGHTHOUSE', name: 'Hải Đăng', size: 2, hp: 5, vision: 8, cost: 300, type: 'STRUCTURE' },
    SUPPLY: { code: 'SUPPLY', name: 'Trạm Tiếp Tế', size: 3, hp: 6, vision: 2, cost: 400, type: 'STRUCTURE', passive: 'HEAL_AOE' },
    SILO: { code: 'SILO', name: 'Bệ Phóng HN', size: 3, hp: 10, vision: 2, cost: 1000, type: 'STRUCTURE', isSilo: true, alwaysVisible: true },
    AIRFIELD: { code: 'AIRFIELD', name: 'Sân Bay', size: 4, hp: 8, vision: 4, cost: 600, type: 'STRUCTURE', passive: 'SPAWN_PLANE', alwaysVisible: true },
    NUCLEAR_PLANT: { code: 'NUCLEAR_PLANT', name: 'Nhà Máy HN', size: 4, hp: 8, vision: 2, cost: 1500, type: 'STRUCTURE', passive: 'GEN_NUKE', alwaysVisible: true }
  },

  ITEMS_STATIC: {
    // --- PASSIVE ---
    ANTI_AIR: { id: 'ANTI_AIR', name: 'Tên lửa PK', type: 'PASSIVE', cost: 200, counter: 'AIR' },
    FLARES: { id: 'FLARES', name: 'Bẫy Nhiệt', type: 'PASSIVE', cost: 150, counter: 'MISSILE' },

    // --- ACTIVE ---
    REPAIR_KIT: { id: 'REPAIR_KIT', name: 'Bộ Sửa Chữa', type: 'ACTIVE', cost: 200 },
    DRONE: { id: 'DRONE', name: 'Drone', type: 'ACTIVE', cost: 150 },
    MERCENARY: { id: 'MERCENARY', name: 'Lính Đánh Thuê', type: 'ACTIVE', cost: 500, turns: 3 },
    SUICIDE_SQUAD: { id: 'SUICIDE_SQUAD', name: 'Lính Cảm Tử', type: 'ACTIVE', cost: 300 },
    BLACK_HAT: { id: 'BLACK_HAT', name: 'Hacker Đen', type: 'ACTIVE', cost: 600 },
    ENGINE_BOOST: { id: 'ENGINE_BOOST', name: 'Động Cơ Phụ', type: 'ACTIVE', cost: 200 },
    JAMMER: { id: 'JAMMER', name: 'Phá Sóng', type: 'ACTIVE', cost: 400 },
    RADAR: { id: 'RADAR', name: 'Radar', type: 'ACTIVE', cost: 500 },
    WHITE_HAT: { id: 'WHITE_HAT', name: 'Hacker Trắng', type: 'ACTIVE', cost: 300 },
    DECOY: { id: 'DECOY', name: 'Xuồng Cứu Hộ', type: 'ACTIVE', cost: 100 },
    NUKE: { id: 'NUKE', name: 'Đầu đạn HN', type: 'ACTIVE', cost: 2000, reqSilo: true },
    
    // --- SKILL UNLOCK ---
    SELF_DESTRUCT: { id: 'SELF_DESTRUCT', name: 'Cảm Tử (Skill)', type: 'SKILL', cost: 0 }
  }
};

// Create exported objects (will be updated dynamically)
let CONSTANTS_EXPORT = {};
let UNITS_EXPORT = {};
let ITEMS_EXPORT = {};
let COMMANDERS_EXPORT = {};
const TERRAIN_EXPORT = configLoader.getTerrain();

function updateExports() {
  const loadedConfig = configLoader.loadConfig();
  CONSTANTS_EXPORT = loadedConfig.constants || loadedConfig.CONSTANTS || STATIC_DEFINITIONS.CONSTANTS_STATIC;
  UNITS_EXPORT = loadedConfig.units || loadedConfig.UNITS || STATIC_DEFINITIONS.UNITS_STATIC;
  ITEMS_EXPORT = loadedConfig.items || loadedConfig.ITEMS || STATIC_DEFINITIONS.ITEMS_STATIC;
  COMMANDERS_EXPORT = loadedConfig.commanders || loadedConfig.COMMANDERS || {};
}

// Reload config (call this after updates)
function reloadConfig() {
  configLoader.clearCache();
  updateExports();
  // Update direct properties for destructured values
  definitions.CONSTANTS = CONSTANTS_EXPORT;
  definitions.UNITS = UNITS_EXPORT;
  definitions.ITEMS = ITEMS_EXPORT;
  return configLoader.loadConfig();
}

// Initialize exports
updateExports();

// Export object with properties for destructuring compatibility
const definitions = {
  get CONSTANTS() {
    return CONSTANTS_EXPORT;
  },

  get TERRAIN() {
    return TERRAIN_EXPORT;
  },

  get UNITS() {
    return UNITS_EXPORT;
  },

  get ITEMS() {
    return ITEMS_EXPORT;
  },

  get COMMANDERS() {
    return COMMANDERS_EXPORT;
  },

  // Helper to reload config
  reload: reloadConfig,

  // Static fallbacks (for reference)
  CONSTANTS_STATIC: STATIC_DEFINITIONS.CONSTANTS_STATIC,
  UNITS_STATIC: STATIC_DEFINITIONS.UNITS_STATIC,
  ITEMS_STATIC: STATIC_DEFINITIONS.ITEMS_STATIC,
  TERRAIN_STATIC: STATIC_DEFINITIONS.TERRAIN_STATIC
};

// For destructuring compatibility, also export as direct properties
// These will be updated on reload
definitions.CONSTANTS = CONSTANTS_EXPORT;
definitions.TERRAIN = TERRAIN_EXPORT;
definitions.UNITS = UNITS_EXPORT;
definitions.ITEMS = ITEMS_EXPORT;
definitions.COMMANDERS = COMMANDERS_EXPORT;

module.exports = definitions;
