import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { useAuth } from '../context/AuthContext';

interface AdminLoginProps {
    onNavigate: (page: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onNavigate }) => {
    const { language } = useLanguage();
    const t = getTranslation(language);
    const { login } = useAuth(); // We might need a special 'loginAdmin' function or just mock it by logging in a specific user

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        if (username === 'master' && password === '!master') {
            // Success
            // TODO: In a real app, we would authenticate properly. 
            // Here we assume 'CR001' is the Admin based on mockData.
            login('CR001');
            onNavigate('dashboard');
        } else {
            setError(t.landing.error);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--background-tint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <div className="glass-card" style={{
                padding: '3rem',
                width: '100%',
                maxWidth: '400px',
                borderRadius: '1rem',
                background: 'var(--surface-color)',
                boxShadow: 'var(--shadow-md)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                    <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>{t.landing.adminLogin}</h2>
                </div>

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{t.landing.username}</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid var(--border-color)',
                                borderRadius: '0.5rem'
                            }}
                            autoFocus
                        />
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{t.landing.password}</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid var(--border-color)',
                                borderRadius: '0.5rem'
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            background: '#fee2e2', color: '#dc2626',
                            padding: '0.75rem', borderRadius: '0.5rem',
                            marginBottom: '1.5rem', textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: 'var(--primary-color)',
                            color: 'white',
                            borderRadius: '0.5rem',
                            fontWeight: 600,
                            marginBottom: '1rem'
                        }}
                    >
                        {t.landing.loginBtn}
                    </button>

                    <button
                        type="button"
                        onClick={() => onNavigate('landing')}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 500
                        }}
                    >
                        {t.landing.back}
                    </button>
                </form>
            </div>
        </div>
    );
};
