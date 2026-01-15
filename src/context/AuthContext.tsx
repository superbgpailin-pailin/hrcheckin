import React, { createContext, useState, useContext, type ReactNode } from 'react';
import { MOCK_EMPLOYEES } from '../data/mockData';
import type { Employee } from '../types';

interface AuthContextType {
    currentUser: Employee | null;
    login: (id: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<Employee | null>(MOCK_EMPLOYEES[2]); // Default to Employee role (Kong)

    const login = (id: string) => {
        const user = MOCK_EMPLOYEES.find((e) => e.id === id);
        if (user) {
            setCurrentUser(user);
        }
    };

    const logout = () => {
        setCurrentUser(null);
    };

    return (
        <AuthContext.Provider value={{ currentUser, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
