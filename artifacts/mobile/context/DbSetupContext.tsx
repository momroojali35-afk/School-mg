import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETUP_KEY = '@db_setup_complete';
export const PENDING_CONFIG_KEY = '@db_pending_config';

export type DbProvider = 'supabase' | 'firebase' | 'postgresql' | 'custom';

export interface PendingDbConfig {
  provider: DbProvider;
  name: string;
  // PostgreSQL / Supabase / Custom
  url?: string;
  // Firebase
  projectId?: string;
  apiKey?: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  serviceAccountJson?: string;
}

interface DbSetupContextType {
  isSetupComplete: boolean | null; // null = loading
  localConfig: PendingDbConfig | null;
  markSetupComplete: () => Promise<void>;
  resetSetup: () => Promise<void>;
  saveLocalConfig: (config: PendingDbConfig) => Promise<void>;
  clearLocalConfig: () => Promise<void>;
}

const DbSetupContext = createContext<DbSetupContextType | null>(null);

export function DbSetupProvider({ children }: { children: React.ReactNode }) {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [localConfig, setLocalConfig] = useState<PendingDbConfig | null>(null);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  async function checkSetupStatus() {
    const [setup, cfg] = await AsyncStorage.multiGet([SETUP_KEY, PENDING_CONFIG_KEY]);
    const localDone = setup[1] === 'true';
    setLocalConfig(cfg[1] ? JSON.parse(cfg[1]) : null);

    if (localDone) {
      // Fast path: this device already went through setup (or a previous server check cached it)
      setIsSetupComplete(true);
      return;
    }

    // Not set locally — ask the server. If the admin already configured a DB
    // on any device, the server will say "connected: true" and we skip setup
    // for all staff devices automatically.
    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const base = domain ? `https://${domain}` : '';
      const res = await fetch(`${base}/api/db-connections/active`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.connected === true) {
          // Server has a DB — cache locally so we skip this check next time
          await AsyncStorage.setItem(SETUP_KEY, 'true');
          setIsSetupComplete(true);
          return;
        }
      }
    } catch {
      // Server unreachable — fall through to show setup screen
    }

    setIsSetupComplete(false);
  }

  const markSetupComplete = async () => {
    await AsyncStorage.setItem(SETUP_KEY, 'true');
    setIsSetupComplete(true);
  };

  const resetSetup = async () => {
    await AsyncStorage.multiRemove([SETUP_KEY, PENDING_CONFIG_KEY]);
    setIsSetupComplete(false);
    setLocalConfig(null);
  };

  const saveLocalConfig = async (config: PendingDbConfig) => {
    await AsyncStorage.setItem(PENDING_CONFIG_KEY, JSON.stringify(config));
    setLocalConfig(config);
  };

  const clearLocalConfig = async () => {
    await AsyncStorage.removeItem(PENDING_CONFIG_KEY);
    setLocalConfig(null);
  };

  return (
    <DbSetupContext.Provider
      value={{ isSetupComplete, localConfig, markSetupComplete, resetSetup, saveLocalConfig, clearLocalConfig }}
    >
      {children}
    </DbSetupContext.Provider>
  );
}

export function useDbSetup() {
  const ctx = useContext(DbSetupContext);
  if (!ctx) throw new Error('useDbSetup must be used within DbSetupProvider');
  return ctx;
}
