import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import './Layout.css';

interface LayoutProps {
    children: React.ReactNode;
    currentPage: string;
    onNavigate: (page: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentPage, onNavigate }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { language } = useLanguage();
    const t = getTranslation(language);

    // Get current page title
    const getPageTitle = () => {
        switch (currentPage) {
            case 'dashboard': return t.menu.dashboard;
            case 'timeAttendance': return t.menu.timeAttendance;
            case 'leaveRequest': return t.menu.leaveRequest;
            case 'myProfile': return t.menu.myProfile;
            case 'employees': return t.menu.employees;
            case 'settings': return t.menu.settings;
            default: return '';
        }
    };

    return (
        <div className="layout">
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                currentPage={currentPage}
                onNavigate={onNavigate}
            />

            <main className="main-content">
                {/* Mobile Header */}
                <header className="header-mobile">
                    <button className="hamburger" onClick={() => setIsSidebarOpen(true)}>
                        ☰
                    </button>
                    <span className="page-title-mobile">{getPageTitle()}</span>
                    <div style={{ width: 40 }} />
                </header>

                {/* Desktop Header */}
                <header className="page-header">
                    <h1 className="page-title">{getPageTitle()}</h1>
                </header>

                <div className="page-container">
                    {children}
                </div>
            </main>

            {isSidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setIsSidebarOpen(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 90,
                        display: window.innerWidth <= 768 ? 'block' : 'none'
                    }}
                />
            )}
        </div>
    );
};
