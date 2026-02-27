import React, { useCallback, useEffect, useState } from 'react';
import { AppEmployeeProvider } from './context/AppEmployeeContext';
import { AppLanguageProvider } from './context/AppLanguageContext';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { PortalAuthProvider, usePortalAuth } from './context/PortalAuthContext';
import { AppShell } from './components/AppShell';
import type { PortalPage } from './types/app';
import { AppLanding } from './pages/AppLanding';
import { AppCheckIn } from './pages/AppCheckIn';
import { AppSelfProfile } from './pages/AppSelfProfile';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AppDashboard } from './pages/AppDashboard';
import { AppAttendance } from './pages/AppAttendance';
import { AppEmployees } from './pages/AppEmployees';
import { AppProfileRequests } from './pages/AppProfileRequests';
import { AppSettings } from './pages/AppSettings';
import { AppKiosk } from './pages/AppKiosk';
import { AppAdmins } from './pages/AppAdmins';
import {
    buildAdminLoginHash,
    buildCheckInHash,
    buildEmployeeProfileHash,
    buildKioskHash,
    buildLandingHash,
    buildPortalHash,
    parseHashRoute,
    type AppRouteState,
    type LoginNext,
} from './utils/routes';

const hashForRoute = (route: AppRouteState): string => {
    if (route.view === 'landing') {
        return buildLandingHash();
    }
    if (route.view === 'checkin') {
        return buildCheckInHash();
    }
    if (route.view === 'kiosk') {
        return buildKioskHash();
    }
    if (route.view === 'employee-profile') {
        return buildEmployeeProfileHash();
    }
    if (route.view === 'admin-login') {
        return buildAdminLoginHash(route.loginNext);
    }
    return buildPortalHash(route.portalPage);
};

const AppContent: React.FC = () => {
    const { portalUser, loginPortal, logoutPortal } = usePortalAuth();
    const [route, setRoute] = useState<AppRouteState>(() => parseHashRoute(window.location.hash));

    useEffect(() => {
        const onHashChange = () => {
            setRoute(parseHashRoute(window.location.hash));
        };

        window.addEventListener('hashchange', onHashChange);
        return () => {
            window.removeEventListener('hashchange', onHashChange);
        };
    }, []);

    const navigate = useCallback((next: AppRouteState) => {
        const targetHash = hashForRoute(next);
        if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
        }
        setRoute(next);
    }, []);

    const openLanding = useCallback(() => {
        navigate({ view: 'landing', portalPage: 'dashboard', loginNext: 'dashboard' });
    }, [navigate]);

    const openCheckIn = useCallback(() => {
        navigate({ view: 'checkin', portalPage: 'dashboard', loginNext: 'dashboard' });
    }, [navigate]);

    const openKioskPage = useCallback(() => {
        navigate({ view: 'kiosk', portalPage: 'dashboard', loginNext: 'kiosk' });
    }, [navigate]);

    const openSelfProfile = useCallback(() => {
        navigate({ view: 'employee-profile', portalPage: 'dashboard', loginNext: 'dashboard' });
    }, [navigate]);

    const openAdminLogin = useCallback((next: LoginNext = 'dashboard') => {
        navigate({
            view: 'admin-login',
            portalPage: next === 'kiosk' ? 'dashboard' : next,
            loginNext: next,
        });
    }, [navigate]);

    const openKiosk = useCallback(() => {
        openAdminLogin('kiosk');
    }, [openAdminLogin]);

    const openPortal = useCallback((page: PortalPage = 'dashboard') => {
        navigate({ view: 'portal', portalPage: page, loginNext: page });
    }, [navigate]);

    if (route.view === 'landing') {
        return (
            <AppLanding
                checkInHref={buildCheckInHash()}
                selfProfileHref={buildEmployeeProfileHash()}
                kioskHref={buildAdminLoginHash('kiosk')}
                adminPortalHref={buildAdminLoginHash('dashboard')}
                onOpenCheckIn={openCheckIn}
                onOpenSelfProfile={openSelfProfile}
                onOpenKiosk={openKiosk}
                onOpenAdminLogin={() => openAdminLogin('dashboard')}
            />
        );
    }

    if (route.view === 'checkin') {
        return <AppCheckIn onBack={openLanding} />;
    }

    if (route.view === 'employee-profile') {
        return <AppSelfProfile onBack={openLanding} />;
    }

    if (route.view === 'kiosk') {
        if (!portalUser) {
            return (
                <AdminLoginPage
                    onBack={openLanding}
                    onLogin={(username, password) => {
                        const result = loginPortal(username, password);
                        if (result.success) {
                            openKioskPage();
                        }
                        return result;
                    }}
                />
            );
        }

        return <AppKiosk onBack={openLanding} />;
    }

    if (route.view === 'admin-login') {
        return (
            <AdminLoginPage
                onBack={openLanding}
                onLogin={(username, password) => {
                    const result = loginPortal(username, password);
                    if (result.success) {
                        if (route.loginNext === 'kiosk') {
                            openKioskPage();
                        } else {
                            openPortal(route.loginNext);
                        }
                    }
                    return result;
                }}
            />
        );
    }

    if (!portalUser) {
        return (
            <AdminLoginPage
                onBack={openLanding}
                onLogin={(username, password) => {
                    const result = loginPortal(username, password);
                    if (result.success) {
                        openPortal(route.portalPage);
                    }
                    return result;
                }}
            />
        );
    }

    const portalPage = route.portalPage;

    return (
        <AppShell
            user={portalUser}
            page={portalPage}
            onNavigate={openPortal}
            onLogout={() => {
                logoutPortal();
                openLanding();
            }}
        >
            {portalPage === 'dashboard' ? <AppDashboard /> : null}
            {portalPage === 'attendance' ? <AppAttendance /> : null}
            {portalPage === 'employees' ? <AppEmployees /> : null}
            {portalPage === 'requests' ? <AppProfileRequests /> : null}
            {portalPage === 'settings' ? <AppSettings /> : null}
            {portalPage === 'admins' ? <AppAdmins /> : null}
        </AppShell>
    );
};

function App() {
    return (
        <AppLanguageProvider>
            <AppSettingsProvider>
                <AppEmployeeProvider>
                    <PortalAuthProvider>
                        <AppContent />
                    </PortalAuthProvider>
                </AppEmployeeProvider>
            </AppSettingsProvider>
        </AppLanguageProvider>
    );
}

export default App;
