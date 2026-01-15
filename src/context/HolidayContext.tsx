import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface SelectedHoliday {
    employeeId: string;
    date: string;
    shift: string;
    requestedAt: string;
}

interface HolidayState {
    isSelectionOpen: boolean;
    blockedDates: string[];
    maxPerDayShift: { [shift: string]: number };
    maxPerPersonMonth: number;
    selectedHolidays: SelectedHoliday[];
}

interface HolidayContextType extends HolidayState {
    setSelectionOpen: (open: boolean) => void;
    addBlockedDate: (date: string) => void;
    removeBlockedDate: (date: string) => void;
    setMaxPerShift: (shift: string, max: number) => void;
    setMaxPerPersonMonth: (max: number) => void;
    addHoliday: (employeeId: string, date: string, shift: string) => boolean;
    removeHoliday: (employeeId: string, date: string) => void;
    getHolidaysForEmployee: (employeeId: string) => SelectedHoliday[];
    getHolidaysForDate: (date: string) => SelectedHoliday[];
    canSelectDate: (date: string, shift: string, employeeId?: string) => { allowed: boolean; reason?: string };
}

const defaultState: HolidayState = {
    isSelectionOpen: false,
    blockedDates: [],
    maxPerDayShift: { 'Morning Shift': 2, 'Evening Shift': 2, 'Night Shift': 1 },
    maxPerPersonMonth: 4,
    selectedHolidays: []
};

const HolidayContext = createContext<HolidayContextType | undefined>(undefined);

export const HolidayProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<HolidayState>(() => {
        const saved = localStorage.getItem('holidayState');
        return saved ? JSON.parse(saved) : defaultState;
    });

    useEffect(() => {
        localStorage.setItem('holidayState', JSON.stringify(state));
    }, [state]);

    const setSelectionOpen = (open: boolean) => {
        setState(prev => ({ ...prev, isSelectionOpen: open }));
    };

    const addBlockedDate = (date: string) => {
        setState(prev => ({
            ...prev,
            blockedDates: prev.blockedDates.includes(date) ? prev.blockedDates : [...prev.blockedDates, date]
        }));
    };

    const removeBlockedDate = (date: string) => {
        setState(prev => ({
            ...prev,
            blockedDates: prev.blockedDates.filter(d => d !== date)
        }));
    };

    const setMaxPerShift = (shift: string, max: number) => {
        setState(prev => ({
            ...prev,
            maxPerDayShift: { ...prev.maxPerDayShift, [shift]: max }
        }));
    };

    const setMaxPerPersonMonth = (max: number) => {
        setState(prev => ({ ...prev, maxPerPersonMonth: max }));
    };

    const getHolidaysForEmployee = (employeeId: string) => {
        return state.selectedHolidays.filter(h => h.employeeId === employeeId);
    };

    const getHolidaysForDate = (date: string) => {
        return state.selectedHolidays.filter(h => h.date === date);
    };

    const canSelectDate = (date: string, shift: string, employeeId?: string): { allowed: boolean; reason?: string } => {
        // Check if selection is open
        if (!state.isSelectionOpen) {
            return { allowed: false, reason: 'Selection is closed' };
        }

        // Check if date is blocked
        if (state.blockedDates.includes(date)) {
            return { allowed: false, reason: 'This date is blocked' };
        }

        // Check quota for this shift on this date
        const holidaysOnDateShift = state.selectedHolidays.filter(h => h.date === date && h.shift === shift);
        const maxAllowed = state.maxPerDayShift[shift] || 2;

        if (holidaysOnDateShift.length >= maxAllowed) {
            return { allowed: false, reason: `Maximum ${maxAllowed} employees for ${shift} on this date` };
        }

        // Check max per person per month
        if (employeeId) {
            const dateObj = new Date(date);
            const monthHolidays = state.selectedHolidays.filter(h => {
                const hDate = new Date(h.date);
                return h.employeeId === employeeId &&
                    hDate.getMonth() === dateObj.getMonth() &&
                    hDate.getFullYear() === dateObj.getFullYear();
            });
            if (monthHolidays.length >= state.maxPerPersonMonth) {
                return { allowed: false, reason: `Maximum ${state.maxPerPersonMonth} holidays per month` };
            }
        }

        return { allowed: true };
    };

    const addHoliday = (employeeId: string, date: string, shift: string): boolean => {
        const check = canSelectDate(date, shift);
        if (!check.allowed) return false;

        // Check if employee already has holiday on this date
        const existing = state.selectedHolidays.find(h => h.employeeId === employeeId && h.date === date);
        if (existing) return false;

        setState(prev => ({
            ...prev,
            selectedHolidays: [
                ...prev.selectedHolidays,
                { employeeId, date, shift, requestedAt: new Date().toISOString() }
            ]
        }));

        return true;
    };

    const removeHoliday = (employeeId: string, date: string) => {
        setState(prev => ({
            ...prev,
            selectedHolidays: prev.selectedHolidays.filter(h => !(h.employeeId === employeeId && h.date === date))
        }));
    };

    return (
        <HolidayContext.Provider value={{
            ...state,
            setSelectionOpen,
            addBlockedDate,
            removeBlockedDate,
            setMaxPerShift,
            setMaxPerPersonMonth,
            addHoliday,
            removeHoliday,
            getHolidaysForEmployee,
            getHolidaysForDate,
            canSelectDate
        }}>
            {children}
        </HolidayContext.Provider>
    );
};

export const useHoliday = () => {
    const context = useContext(HolidayContext);
    if (!context) {
        throw new Error('useHoliday must be used within HolidayProvider');
    }
    return context;
};
