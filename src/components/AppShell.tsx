import React, { useState } from 'react';
import type { PortalPage, PortalUser } from '../types/app';
import { PortalSidebar } from './PortalSidebar';

interface AppShellProps {
    user: PortalUser;
    page: PortalPage;
    onNavigate: (page: PortalPage) => void;
    onLogout: () => void;
    children: React.ReactNode;
}

const pageTitle: Record<PortalPage, string> = {
    dashboard: 'Dashboard',
    attendance: 'Attendance',
    reports: 'Reports',
    employees: 'Employees',
    requests: 'Profile Requests',
    settings: 'Settings',
    admins: 'Add Admin',
};

export const AppShell: React.FC<AppShellProps> = ({ user, page, onNavigate, onLogout, children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="portal-layout">
            <PortalSidebar
                open={sidebarOpen}
                currentPage={page}
                user={user}
                onClose={() => setSidebarOpen(false)}
                onNavigate={onNavigate}
                onLogout={onLogout}
            />

            <div className="portal-content-wrap">
                <header className="portal-header">
                    <button
                        className="hamburger-btn"
                        type="button"
                        onClick={() => setSidebarOpen(true)}
                    >
                        ☰
                    </button>
                    <div>
                        <h1>{pageTitle[page]}</h1>
                        <p>{user.displayName}</p>
                    </div>
                </header>

                <main className="portal-main">{children}</main>
            </div>
        </div>
    );
};
