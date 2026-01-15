import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getTranslation } from '../data/translations';
import './Sidebar.css';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    currentPage: string;
    onNavigate: (page: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentPage, onNavigate }) => {
    const { language, toggleLanguage } = useLanguage();
    const { currentUser, logout } = useAuth();
    const t = getTranslation(language);

    if (!currentUser) return null;

    const NavItem = ({ page, label, icon }: { page: string; label: string; icon?: string }) => (
        <a
            href="#"
            className={`nav-item ${currentPage === page ? 'active' : ''}`}
            onClick={(e) => {
                e.preventDefault();
                onNavigate(page);
                if (window.innerWidth <= 768) onClose();
            }}
        >
            {icon && <span style={{ marginRight: '10px' }}>{icon}</span>}
            {label}
        </a>
    );

    const isAdminOrSupervisor = currentUser.role === 'Admin' || currentUser.role === 'Supervisor';

    return (
        <>
            <div className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <span className="logo">HR Mate</span>
                </div>

                <nav className="sidebar-nav">
                    {/* 1. แดชบอร์ด */}
                    <NavItem page="dashboard" label={t.menu.dashboard} icon="📊" />

                    {/* 2. สรุปรายเดือน */}
                    {currentUser.role === 'Admin' && (
                        <NavItem page="monthlySummary" label={language === 'th' ? 'สรุปรายเดือน' : 'Monthly Summary'} icon="📈" />
                    )}

                    {/* 3. พนักงาน */}
                    {isAdminOrSupervisor && (
                        <NavItem page="employees" label={t.menu.employees} icon="👥" />
                    )}

                    {/* 4. การลาและคำขอ */}
                    <NavItem page="leaveRequest" label={t.menu.leaveRequest} icon="📅" />

                    {/* 5. ตรวจสอบเช็คอิน */}
                    <NavItem page="adminAttendance" label={t.menu.timeAttendance} icon="📋" />

                    {/* 6. จัดการหน้างาน */}
                    {currentUser.role === 'Admin' && (
                        <NavItem page="siteManagement" label={t.menu.siteManagement} icon="📍" />
                    )}

                    {/* 7. จัดการวันหยุด */}
                    {currentUser.role === 'Admin' && (
                        <NavItem page="holidayAdmin" label={language === 'th' ? 'จัดการวันหยุด' : 'Holiday Mgmt'} icon="🗓️" />
                    )}

                    {/* 8. ตั้งค่าระบบ */}
                    {currentUser.role === 'Admin' && (
                        <NavItem page="settings" label={t.menu.settings} icon="⚙️" />
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <img src={currentUser.photoUrl} alt="Profile" className="user-avatar" />
                        <div className="user-details">
                            <span className="user-name">
                                {language === 'th' ? currentUser.nickname : currentUser.firstNameEN}
                            </span>
                            <span className="user-role">{t.role[currentUser.role]}</span>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <button onClick={toggleLanguage} className="lang-toggle">
                            {language === 'th' ? '🇬🇧 EN' : '🇹🇭 TH'}
                        </button>
                        <button
                            className="logout-btn"
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                background: 'rgba(255, 50, 50, 0.2)',
                                border: '1px solid rgba(255, 50, 50, 0.4)',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 50, 50, 0.4)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 50, 50, 0.2)'}
                            onClick={() => {
                                onClose();
                                logout();
                                onNavigate('landing');
                            }}
                        >
                            {t.common.logout}
                        </button>
                    </div>
                </div>
            </div>

            {isOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 90,
                        display: window.innerWidth <= 768 ? 'block' : 'none'
                    }}
                />
            )}
        </>
    );
};
