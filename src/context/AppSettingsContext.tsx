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

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<AppSystemConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await appSettingsService.getSettings();
                setConfig(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดการตั้งค่าได้');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []);

    const saveConfig = useCallback(async () => {
        await appSettingsService.saveSettings(config);
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
