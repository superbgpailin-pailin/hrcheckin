import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';

interface LandingPageProps {
    onNavigate: (page: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
    const { language } = useLanguage();
    const t = getTranslation(language);

    const cards = [
        { id: 'admin-login', label: t.landing.admin, icon: '🖥️', color: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' },
        { id: 'timeAttendance', label: t.landing.checkIn, icon: '⏱️', color: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' },
        { id: 'employeeLeave', label: language === 'th' ? 'ขอแก้ไขเวลา' : 'Time Correction', icon: '⏰', color: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' },
        { id: 'historyHoliday', label: language === 'th' ? 'ประวัติ & วันหยุด' : 'History & Holidays', icon: '📅', color: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' },
        { id: 'myProfile', label: t.landing.profile, icon: '👤', color: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' },
    ];

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--background-tint)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <h1 style={{
                marginBottom: '3rem',
                fontSize: '2.5rem',
                color: 'var(--primary-color)',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                {t.appName}
            </h1>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '2rem',
                maxWidth: '800px',
                width: '100%'
            }}>
                {cards.map(card => (
                    <button
                        key={card.id}
                        onClick={() => onNavigate(card.id)}
                        className="glass-card"
                        style={{
                            padding: '3rem 2rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: card.color,
                            color: 'white',
                            border: 'none',
                            borderRadius: '1.5rem',
                            cursor: 'pointer',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                        }}
                    >
                        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>{card.icon}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{card.label}</div>
                    </button>
                ))}
            </div>

            <footer style={{ marginTop: '4rem', opacity: 0.6, fontSize: '0.9rem' }}>
                © {new Date().getFullYear()} HR CheckIn System
            </footer>
        </div>
    );
};
