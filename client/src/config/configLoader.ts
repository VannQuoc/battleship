// client/src/config/configLoader.ts
// Loads game config from API

import type { UnitDefinition, ItemDefinition } from '../types';

interface GameConfig {
  constants: Record<string, any>;
  units: Record<string, UnitDefinition>;
  items: Record<string, ItemDefinition>;
}

let cachedConfig: GameConfig | null = null;
let configPromise: Promise<GameConfig> | null = null;

// Get API URL - handle both full URL and relative path
const getApiUrl = () => {
  if (typeof window === 'undefined') {
    return import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
  }
  const envUrl = import.meta.env.VITE_SERVER_URL;
  if (envUrl) {
    // If it's a full URL, use it
    if (envUrl.startsWith('http://') || envUrl.startsWith('https://')) {
      return envUrl;
    }
    // If it's just a host:port, construct full URL
    return `http://${envUrl}`;
  }
  // Default to same origin
  return window.location.origin;
};

const API_URL = getApiUrl();

export async function loadConfig(): Promise<GameConfig> {
  // Return cached config if available
  if (cachedConfig) {
    return cachedConfig;
  }

  // Return existing promise if already loading
  if (configPromise) {
    return configPromise;
  }

  // Load config from API
  configPromise = fetch(`${API_URL}/api/config`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load config: ${res.statusText}`);
      }
      return res.json();
    })
    .then((config) => {
      cachedConfig = config;
      return config;
    })
    .catch((error) => {
      console.error('[Config] Error loading config from API, using fallback:', error);
      // Return fallback config
      return getFallbackConfig();
    })
    .finally(() => {
      configPromise = null;
    });

  return configPromise;
}

export function clearConfigCache() {
  cachedConfig = null;
  configPromise = null;
}

// Fallback config (same as current hardcoded values)
function getFallbackConfig(): GameConfig {
  return {
    constants: {
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
    units: {},
    items: {},
  };
}
