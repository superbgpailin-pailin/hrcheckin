import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

interface EmployeeLayoutProps {
    children: React.ReactNode;
    onNavigate: (page: string) => void;
    titleKey: string;
}

export const EmployeeLayout: React.FC<EmployeeLayoutProps> = ({ children, onNavigate, titleKey }) => {
    const { language } = useLanguage();
    const t = getTranslation(language);
    const { logout } = useAuth();

    // Helper to get title text
    const getTitle = () => {
        if (titleKey === 'checkIn') return t.landing.checkIn;
        if (titleKey === 'profile') return t.landing.profile;
        if (titleKey === 'history') return t.landing.history;
        return '';
    };

    return (
        <div className="layout" style={{ display: 'block', minHeight: '100vh', background: 'var(--background-tint)' }}>
            <header className="page-header" style={{ padding: '0 2rem', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => {
                            logout();
                            onNavigate('landing');
                        }}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0.5rem',
                            padding: '0.5rem 1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: 'var(--text-primary)'
                        }}
                    >
                        ⬅ {t.landing.back}
                    </button>
                    <h1 className="page-title" style={{ margin: 0, fontSize: '1.5rem' }}>{getTitle()}</h1>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {t.appName}
                </div>
            </header>

            <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
                {children}
            </main>
        </div>
    );
};
