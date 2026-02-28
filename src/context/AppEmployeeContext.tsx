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
const PREVIOUS_EMPLOYEES_CACHE_KEY = 'hrcheckin_employees_cache_v2';
const EMPLOYEES_CACHE_KEY = 'hrcheckin_employees_cache_v3';

interface CachedEmployee {
    id: string;
    role: AppEmployee['role'];
    firstNameTH: string;
    lastNameTH: string;
    firstNameEN: string;
    lastNameEN: string;
    nickname: string;
    position: string;
    department: string;
    status: AppEmployee['status'];
    pin: string;
}

const buildEmployeeAvatar = (employeeId: string): string => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(employeeId)}&background=334155&color=fff`;
};

const toCachedEmployee = (employee: AppEmployee): CachedEmployee => {
    return {
        id: employee.id,
        role: employee.role,
        firstNameTH: employee.firstNameTH,
        lastNameTH: employee.lastNameTH,
        firstNameEN: employee.firstNameEN,
        lastNameEN: employee.lastNameEN,
        nickname: employee.nickname,
        position: employee.position,
        department: employee.department,
        status: employee.status,
        pin: employee.pin,
    };
};

const toAppEmployeeFromCache = (employee: CachedEmployee): AppEmployee => {
    return {
        id: employee.id,
        role: employee.role,
        firstNameTH: employee.firstNameTH,
        lastNameTH: employee.lastNameTH,
        firstNameEN: employee.firstNameEN,
        lastNameEN: employee.lastNameEN,
        nickname: employee.nickname,
        position: employee.position,
        department: employee.department,
        status: employee.status,
        photoUrl: buildEmployeeAvatar(employee.id),
        pin: employee.pin,
        email: '',
        phoneNumber: '',
        birthDate: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        selfieUrl: '',
        idCardUrl: '',
        passportUrl: '',
        startDate: new Date().toISOString().slice(0, 10),
        defaultShiftId: undefined,
    };
};

const sortEmployeesById = (items: AppEmployee[]): AppEmployee[] => {
    return [...items].sort((a, b) => a.id.localeCompare(b.id));
};

const readStoredEmployees = (): AppEmployee[] => {
    try {
        const raw = localStorage.getItem(EMPLOYEES_CACHE_KEY);
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw) as Array<AppEmployee | CachedEmployee>;
        if (!Array.isArray(parsed)) {
            return [];
        }

        return sortEmployeesById(parsed.map((employee) => {
            if ('photoUrl' in employee && 'email' in employee) {
                return employee as AppEmployee;
            }

            return toAppEmployeeFromCache(employee as CachedEmployee);
        }));
    } catch {
        return [];
    }
};

const persistEmployees = (items: AppEmployee[]): void => {
    try {
        const cachedItems = sortEmployeesById(items).map(toCachedEmployee);
        localStorage.setItem(EMPLOYEES_CACHE_KEY, JSON.stringify(cachedItems));
    } catch {
        try {
            localStorage.removeItem(EMPLOYEES_CACHE_KEY);
        } catch {
            // Ignore storage failures. Cache is optional.
        }
    }
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
        localStorage.removeItem(PREVIOUS_EMPLOYEES_CACHE_KEY);
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
