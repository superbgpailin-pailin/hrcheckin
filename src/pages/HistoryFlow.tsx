import React, { useState } from 'react';
import { PublicUserAuth } from '../components/PublicUserAuth';
import { AttendanceHistory } from './AttendanceHistory';
import { useAuth } from '../context/AuthContext';

export const HistoryFlow: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const { login } = useAuth();

    const handleAuth = (employee: any) => {
        login(employee.id);
        setIsAuthenticated(true);
    };

    if (isAuthenticated) {
        return <AttendanceHistory />;
    }

    return (
        <div style={{ padding: '2rem' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--primary-color)' }}>Attendance History Access</h1>
            <PublicUserAuth
                onAuthenticated={handleAuth}
                onCancel={() => window.location.reload()}
            />
        </div>
    );
};
