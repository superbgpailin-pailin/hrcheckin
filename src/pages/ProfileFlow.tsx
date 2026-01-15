import React, { useState } from 'react';
import { PublicUserAuth } from '../components/PublicUserAuth';
import { MyProfile } from './MyProfile';
import { useAuth } from '../context/AuthContext';

export const ProfileFlow: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const { login } = useAuth();

    const handleAuth = (employee: any) => {
        login(employee.id);
        setIsAuthenticated(true);
    };

    if (isAuthenticated) {
        return <MyProfile />;
    }

    return (
        <div style={{ padding: '2rem' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--primary-color)' }}>My Profile Access</h1>
            <PublicUserAuth
                onAuthenticated={handleAuth}
                onCancel={() => window.location.reload()} // Quick way to reset/back in this context
            />
        </div>
    );
};
