// server/src/config/configLoader.js
// Loads game config from shared JSON file

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../../../shared/gameConfig.json');

let cachedConfig = null;
let lastModified = 0;

function loadConfig() {
  try {
    const stats = fs.statSync(configPath);
    // Only reload if file was modified
    if (stats.mtimeMs > lastModified || !cachedConfig) {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      cachedConfig = JSON.parse(fileContent);
      lastModified = stats.mtimeMs;
    }
    return cachedConfig;
  } catch (error) {
    console.error('[Config] Error loading config, using fallback:', error.message);
    // Fallback to static definitions if file doesn't exist
    const fallback = require('./definitions');
    return {
      constants: fallback.CONSTANTS_STATIC,
      units: fallback.UNITS_STATIC,
      items: fallback.ITEMS_STATIC
    };
  }
}

function getConstants() {
  const config = loadConfig();
  return config.constants || config.CONSTANTS || {};
}

function getUnits() {
  const config = loadConfig();
  return config.units || config.UNITS || {};
}

function getItems() {
  const config = loadConfig();
  return config.items || config.ITEMS || {};
}

function getTerrain() {
  // Terrain is static, doesn't need to be in config
  return {
    WATER: 0,
    ISLAND: 1,
    REEF: 2,
    STORM: 3,
    FOG: 4
  };
}

// Clear cache (useful after config update)
function clearCache() {
  cachedConfig = null;
  lastModified = 0;
}

module.exports = {
  loadConfig,
  getConstants,
  getUnits,
  getItems,
  getTerrain,
  clearCache
};

