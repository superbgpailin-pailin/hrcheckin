import React from 'react';
import type { PortalPage, PortalUser } from '../types/app';
import { buildPortalHash } from '../utils/routes';

interface PortalSidebarProps {
    open: boolean;
    currentPage: PortalPage;
    user: PortalUser;
    onClose: () => void;
    onNavigate: (page: PortalPage) => void;
    onLogout: () => void;
}

const MENU: Array<{ page: PortalPage; icon: string; label: string; masterOnly?: boolean }> = [
    { page: 'dashboard', icon: '📊', label: 'ภาพรวม' },
    { page: 'attendance', icon: '🕒', label: 'รายการเช็คอิน' },
    { page: 'reports', icon: 'R', label: 'รายงานสรุป' },
    { page: 'employees', icon: '👥', label: 'พนักงาน' },
    { page: 'requests', icon: '🧾', label: 'คำขอพนักงาน' },
    { page: 'settings', icon: '⚙️', label: 'ตั้งค่า' },
    { page: 'admins', icon: '🔐', label: 'เพิ่มแอดมิน', masterOnly: true },
];

export const PortalSidebar: React.FC<PortalSidebarProps> = ({
    open,
    currentPage,
    user,
    onClose,
    onNavigate,
    onLogout,
}) => {
    const visibleMenu = MENU.filter((item) => !item.masterOnly || user.role === 'Master');

    return (
        <>
            <aside className={`portal-sidebar ${open ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <div className="brand-mark">HR</div>
                    <div>
                        <div className="brand-title">HR CheckIn</div>
                        <div className="brand-subtitle">Admin Portal</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {visibleMenu.map((item) => (
                        <a
                            key={item.page}
                            className={`sidebar-link ${currentPage === item.page ? 'active' : ''}`}
                            href={buildPortalHash(item.page)}
                            onClick={(event) => {
                                event.preventDefault();
                                onNavigate(item.page);
                                onClose();
                            }}
                        >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </a>
                    ))}
                </nav>

                <div className="sidebar-user">
                    <img src={user.photoUrl} alt={user.displayName} />
                    <div>
                        <div className="user-name">{user.displayName}</div>
                        <div className="user-role">{user.role}</div>
                    </div>
                </div>

                <button className="sidebar-logout" type="button" onClick={onLogout}>
                    ออกจากระบบ
                </button>
            </aside>

            {open ? <button className="sidebar-overlay" type="button" onClick={onClose} aria-label="Close sidebar" /> : null}
        </>
    );
};
