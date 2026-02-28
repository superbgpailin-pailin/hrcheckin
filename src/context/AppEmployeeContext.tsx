/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppEmployee } from '../types/app';
import { appEmployeeService } from '../services/appEmployeeService';

interface AppEmployeeContextValue {
    employees: AppEmployee[];
    loading: boolean;
    error: string | null;
    refreshEmployees: () => Promise<void>;
    saveEmployee: (employee: AppEmployee) => Promise<void>;
    saveEmployees: (items: AppEmployee[]) => Promise<void>;
    deleteEmployee: (employeeId: string) => Promise<void>;
}

const AppEmployeeContext = createContext<AppEmployeeContextValue | undefined>(undefined);

const LEGACY_EMPLOYEES_CACHE_KEY = 'hrcheckin_employees_cache_v1';
const EMPLOYEES_CACHE_KEY = 'hrcheckin_employees_cache_v2';

const sortEmployeesById = (items: AppEmployee[]): AppEmployee[] => {
    return [...items].sort((a, b) => a.id.localeCompare(b.id));
};

const readStoredEmployees = (): AppEmployee[] => {
    try {
        const raw = localStorage.getItem(EMPLOYEES_CACHE_KEY);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw) as AppEmployee[];
        return Array.isArray(parsed) ? sortEmployeesById(parsed) : [];
    } catch {
        return [];
    }
};

const persistEmployees = (items: AppEmployee[]): void => {
    localStorage.setItem(EMPLOYEES_CACHE_KEY, JSON.stringify(sortEmployeesById(items)));
};

const mergeEmployees = (current: AppEmployee[], nextItems: AppEmployee[]): AppEmployee[] => {
    const map = new Map(current.map((employee) => [employee.id, employee]));
    nextItems.forEach((employee) => {
        map.set(employee.id, employee);
    });
    return sortEmployeesById(Array.from(map.values()));
};

interface AppEmployeeProviderProps {
    children: React.ReactNode;
    enabled?: boolean;
}

export const AppEmployeeProvider: React.FC<AppEmployeeProviderProps> = ({ children, enabled = true }) => {
    const initialEmployees = readStoredEmployees();
    const [employees, setEmployees] = useState<AppEmployee[]>(initialEmployees);
    const [loading, setLoading] = useState(() => enabled && initialEmployees.length === 0);
    const [error, setError] = useState<string | null>(null);

    const loadEmployees = useCallback(async (silent = false) => {
        if (!silent) {
            setLoading(true);
        }
        setError(null);
        try {
            const result = await appEmployeeService.getEmployees();
            setEmployees(result);
            persistEmployees(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดรายชื่อพนักงานได้');
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshEmployees = useCallback(async () => {
        await loadEmployees(false);
    }, [loadEmployees]);

    useEffect(() => {
        localStorage.removeItem(LEGACY_EMPLOYEES_CACHE_KEY);
    }, []);

    useEffect(() => {
        if (!enabled) {
            setLoading(false);
            return;
        }

        const hasCachedEmployees = readStoredEmployees().length > 0;
        void loadEmployees(hasCachedEmployees);
    }, [enabled, loadEmployees]);

    const saveEmployee = useCallback(async (employee: AppEmployee) => {
        await appEmployeeService.upsertEmployee(employee);
        setEmployees((current) => {
            const next = mergeEmployees(current, [employee]);
            persistEmployees(next);
            return next;
        });
    }, []);

    const saveEmployees = useCallback(async (items: AppEmployee[]) => {
        await appEmployeeService.upsertEmployees(items);
        setEmployees((current) => {
            const next = mergeEmployees(current, items);
            persistEmployees(next);
            return next;
        });
    }, []);

    const deleteEmployee = useCallback(async (employeeId: string) => {
        await appEmployeeService.deleteEmployee(employeeId);
        setEmployees((current) => {
            const next = current.filter((employee) => employee.id !== employeeId);
            persistEmployees(next);
            return next;
        });
    }, []);

    const value = useMemo<AppEmployeeContextValue>(() => {
        return {
            employees,
            loading,
            error,
            refreshEmployees,
            saveEmployee,
            saveEmployees,
            deleteEmployee,
        };
    }, [deleteEmployee, employees, error, loading, refreshEmployees, saveEmployee, saveEmployees]);

    return <AppEmployeeContext.Provider value={value}>{children}</AppEmployeeContext.Provider>;
};

export const useAppEmployees = (): AppEmployeeContextValue => {
    const context = useContext(AppEmployeeContext);
    if (!context) {
        throw new Error('useAppEmployees must be used within AppEmployeeProvider');
    }
    return context;
};
