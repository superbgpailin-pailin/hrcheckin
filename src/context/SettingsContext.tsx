import React, { createContext, useContext, useState } from 'react';

export interface Shift {
    id: string;
    name: string;
    start: string;
    end: string;
    breakDuration: number; // minutes
}

export interface LatenessRule {
    minutes: number;
    amount: number;
}

export interface SystemConfig {
    companyName: string;
    logoUrl?: string; // Base64
    geoFence: boolean;
    selfie: boolean;
    qrScan: boolean;
    lateThreshold: number;
    lineToken: string;
    telegramToken: string;
    notifyCheckIn: boolean;
    notifyRequest: boolean;
    latenessRules: LatenessRule[];
    shifts: Shift[];
    // Feature Toggles
    featureHolidaySelection: boolean;
    featureTimeCorrection: boolean;
    featureGeofenceCheck: boolean;
    featureSelfieCheck: boolean;
}

const DEFAULT_CONFIG: SystemConfig = {
    companyName: 'Hr Checkin Co., Ltd.',
    geoFence: true,
    selfie: true,
    qrScan: false,
    lateThreshold: 15,
    lineToken: '',
    telegramToken: '',
    notifyCheckIn: true,
    notifyRequest: true,
    latenessRules: [
        { minutes: 15, amount: 50 },
        { minutes: 30, amount: 100 }
    ],
    shifts: [
        { id: '1', name: 'Morning Shift', start: '08:00', end: '17:00', breakDuration: 60 },
        { id: '2', name: 'Afternoon Shift', start: '13:00', end: '22:00', breakDuration: 60 },
        { id: '3', name: 'Night Shift', start: '22:00', end: '07:00', breakDuration: 60 },
    ],
    // Feature Toggles - default ON
    featureHolidaySelection: true,
    featureTimeCorrection: true,
    featureGeofenceCheck: true,
    featureSelfieCheck: true
};

interface SettingsContextType {
    config: SystemConfig;
    updateConfig: (newConfig: Partial<SystemConfig>) => void;
    saveConfig: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<SystemConfig>(() => {
        const saved = localStorage.getItem('hr_settings');
        return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    });

    const updateConfig = (newConfig: Partial<SystemConfig>) => {
        setConfig(prev => ({ ...prev, ...newConfig }));
    };

    const saveConfig = () => {
        localStorage.setItem('hr_settings', JSON.stringify(config));
        alert('บันทึกการตั้งค่าสำเร็จ / Settings Saved Successfully!');
    };

    return (
        <SettingsContext.Provider value={{ config, updateConfig, saveConfig }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within SettingsProvider');
    return context;
};
