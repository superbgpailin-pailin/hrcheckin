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
    deleteEmployee: (employeeId: string) => Promise<void>;
}

const AppEmployeeContext = createContext<AppEmployeeContextValue | undefined>(undefined);

export const AppEmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [employees, setEmployees] = useState<AppEmployee[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshEmployees = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await appEmployeeService.getEmployees();
            setEmployees(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดรายชื่อพนักงานได้');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshEmployees();
    }, [refreshEmployees]);

    const saveEmployee = useCallback(async (employee: AppEmployee) => {
        await appEmployeeService.upsertEmployee(employee);
        await refreshEmployees();
    }, [refreshEmployees]);

    const deleteEmployee = useCallback(async (employeeId: string) => {
        await appEmployeeService.deleteEmployee(employeeId);
        await refreshEmployees();
    }, [refreshEmployees]);

    const value = useMemo<AppEmployeeContextValue>(() => {
        return {
            employees,
            loading,
            error,
            refreshEmployees,
            saveEmployee,
            deleteEmployee,
        };
    }, [deleteEmployee, employees, error, loading, refreshEmployees, saveEmployee]);

    return <AppEmployeeContext.Provider value={value}>{children}</AppEmployeeContext.Provider>;
};

export const useAppEmployees = (): AppEmployeeContextValue => {
    const context = useContext(AppEmployeeContext);
    if (!context) {
        throw new Error('useAppEmployees must be used within AppEmployeeProvider');
    }
    return context;
};
