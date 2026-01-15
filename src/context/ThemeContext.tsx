import React, { createContext, useState, useContext, useEffect, type ReactNode } from 'react';

export type ThemeColor = 'blue' | 'green' | 'purple' | 'orange';
export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
    themeColor: ThemeColor;
    setThemeColor: (color: ThemeColor) => void;
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [themeColor, setThemeColor] = useState<ThemeColor>('blue');
    const [themeMode, setThemeMode] = useState<ThemeMode>('light');

    // Apply Color Theme
    useEffect(() => {
        const root = document.documentElement;
        switch (themeColor) {
            case 'blue':
                root.style.setProperty('--primary-color', '#2563eb');
                root.style.setProperty('--primary-hover', '#1d4ed8');
                root.style.setProperty('--primary-light', '#eff6ff');
                // Softer Blue Gradient (Blue-400 to Blue-600)
                root.style.setProperty('--primary-gradient', 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)');
                root.style.setProperty('--background-tint', themeMode === 'dark' ? '#1e293b' : '#f0f7ff');
                break;
            case 'green':
                root.style.setProperty('--primary-color', '#10b981');
                root.style.setProperty('--primary-hover', '#059669');
                root.style.setProperty('--primary-light', '#ecfdf5');
                // Softer Green Gradient (Green-400 to Green-600)
                root.style.setProperty('--primary-gradient', 'linear-gradient(135deg, #34d399 0%, #059669 100%)');
                root.style.setProperty('--background-tint', themeMode === 'dark' ? '#1e293b' : '#f0fdf4');
                break;
            case 'purple':
                root.style.setProperty('--primary-color', '#7c3aed');
                root.style.setProperty('--primary-hover', '#6d28d9');
                root.style.setProperty('--primary-light', '#f5f3ff');
                // Softer Purple Gradient (Purple-400 to Purple-600)
                root.style.setProperty('--primary-gradient', 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)');
                root.style.setProperty('--background-tint', themeMode === 'dark' ? '#1e293b' : '#faf5ff');
                break;
            case 'orange':
                root.style.setProperty('--primary-color', '#f97316');
                root.style.setProperty('--primary-hover', '#ea580c');
                root.style.setProperty('--primary-light', '#fff7ed');
                // Softer Orange Gradient (Orange-400 to Orange-600)
                root.style.setProperty('--primary-gradient', 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)');
                root.style.setProperty('--background-tint', themeMode === 'dark' ? '#1e293b' : '#fff7ed');
                break;
        }
    }, [themeColor, themeMode]);

    // Apply Dark/Light Mode
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeMode);
    }, [themeMode]);

    return (
        <ThemeContext.Provider value={{ themeColor, setThemeColor, themeMode, setThemeMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
