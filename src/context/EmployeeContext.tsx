import React, { createContext, useContext, useState, useEffect } from 'react';
import { MOCK_EMPLOYEES } from '../data/mockData';
import type { Employee } from '../types';

interface EmployeeContextType {
    employees: Employee[];
    addEmployee: (emp: Employee) => void;
    updateEmployee: (emp: Employee) => void;
    deleteEmployee: (id: string) => void;
    getEmployee: (id: string) => Employee | undefined;
}

const EmployeeContext = createContext<EmployeeContextType | undefined>(undefined);

export const EmployeeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [employees, setEmployees] = useState<Employee[]>(() => {
        const saved = localStorage.getItem('hr_employees');
        return saved ? JSON.parse(saved) : MOCK_EMPLOYEES;
    });

    useEffect(() => {
        localStorage.setItem('hr_employees', JSON.stringify(employees));
    }, [employees]);

    const addEmployee = (emp: Employee) => {
        setEmployees(prev => [...prev, emp]);
    };

    const updateEmployee = (emp: Employee) => {
        setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e));
    };

    const deleteEmployee = (id: string) => {
        setEmployees(prev => prev.filter(e => e.id !== id));
    };

    const getEmployee = (id: string) => {
        return employees.find(e => e.id === id);
    };

    return (
        <EmployeeContext.Provider value={{ employees, addEmployee, updateEmployee, deleteEmployee, getEmployee }}>
            {children}
        </EmployeeContext.Provider>
    );
};

export const useEmployee = () => {
    const context = useContext(EmployeeContext);
    if (!context) throw new Error('useEmployee must be used within EmployeeProvider');
    return context;
};
