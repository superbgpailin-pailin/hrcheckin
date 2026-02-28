/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSystemConfig } from '../types/app';
import { DEFAULT_CONFIG } from '../data/appDefaults';
import { appSettingsService } from '../services/appSettingsService';

interface AppSettingsContextValue {
    config: AppSystemConfig;
    loading: boolean;
    error: string | null;
    setConfig: React.Dispatch<React.SetStateAction<AppSystemConfig>>;
    saveConfig: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

const SETTINGS_CACHE_KEY = 'hrcheckin_settings_cache_v1';

const readStoredConfig = (): AppSystemConfig => {
    try {
        const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
        if (!raw) {
            return DEFAULT_CONFIG;
        }

        const parsed = JSON.parse(raw) as AppSystemConfig;
        return parsed || DEFAULT_CONFIG;
    } catch {
        return DEFAULT_CONFIG;
    }
};

const persistConfig = (config: AppSystemConfig): void => {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(config));
};

interface AppSettingsProviderProps {
    children: React.ReactNode;
    enabled?: boolean;
}

export const AppSettingsProvider: React.FC<AppSettingsProviderProps> = ({ children, enabled = true }) => {
    const initialConfig = readStoredConfig();
    const [config, setConfig] = useState<AppSystemConfig>(initialConfig);
    const [loading, setLoading] = useState(() => enabled && initialConfig === DEFAULT_CONFIG);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        let active = true;

        const load = async () => {
            const hasCachedConfig = localStorage.getItem(SETTINGS_CACHE_KEY);
            setLoading(!hasCachedConfig);
            setError(null);
            try {
                const result = await appSettingsService.getSettings();
                if (!active) {
                    return;
                }
                setConfig(result);
                persistConfig(result);
            } catch (err) {
                if (!active) {
                    return;
                }
                setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดการตั้งค่าได้');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        void load();
        return () => {
            active = false;
        };
    }, [enabled]);

    const saveConfig = useCallback(async () => {
        await appSettingsService.saveSettings(config);
        persistConfig(config);
    }, [config]);

    const value = useMemo<AppSettingsContextValue>(() => {
        return {
            config,
            loading,
            error,
            setConfig,
            saveConfig,
        };
    }, [config, error, loading, saveConfig]);

    return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = (): AppSettingsContextValue => {
    const context = useContext(AppSettingsContext);
    if (!context) {
        throw new Error('useAppSettings must be used within AppSettingsProvider');
    }
    return context;
};
