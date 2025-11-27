// client/src/contexts/ConfigContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { loadConfig, clearConfigCache } from '../config/configLoader';
import type { UnitDefinition, ItemDefinition } from '../types';

interface GameConfig {
  constants: Record<string, any>;
  units: Record<string, UnitDefinition>;
  items: Record<string, ItemDefinition>;
}

interface ConfigContextType {
  config: GameConfig | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const loadedConfig = await loadConfig();
      setConfig(loadedConfig);
    } catch (err: any) {
      setError(err.message || 'Failed to load config');
      console.error('[ConfigContext] Error loading config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reload = async () => {
    clearConfigCache();
    await load();
  };

  return (
    <ConfigContext.Provider value={{ config, loading, error, reload }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
}

