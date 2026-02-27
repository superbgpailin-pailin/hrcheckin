/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AppLanguage = 'th' | 'km';

interface AppLanguageContextValue {
    language: AppLanguage;
    setLanguage: (language: AppLanguage) => void;
    toggleLanguage: () => void;
}

const storageKey = 'hrcheckin_language_v1';
const AppLanguageContext = createContext<AppLanguageContextValue | undefined>(undefined);

export const AppLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<AppLanguage>(() => {
        const fromStorage = localStorage.getItem(storageKey);
        return fromStorage === 'km' ? 'km' : 'th';
    });

    const setLanguage = useCallback((next: AppLanguage) => {
        setLanguageState(next);
        localStorage.setItem(storageKey, next);
    }, []);

    const toggleLanguage = useCallback(() => {
        setLanguage(language === 'th' ? 'km' : 'th');
    }, [language, setLanguage]);

    const value = useMemo<AppLanguageContextValue>(() => {
        return {
            language,
            setLanguage,
            toggleLanguage,
        };
    }, [language, setLanguage, toggleLanguage]);

    return <AppLanguageContext.Provider value={value}>{children}</AppLanguageContext.Provider>;
};

export const useAppLanguage = (): AppLanguageContextValue => {
    const context = useContext(AppLanguageContext);
    if (!context) {
        throw new Error('useAppLanguage must be used within AppLanguageProvider');
    }
    return context;
};
