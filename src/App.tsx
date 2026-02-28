import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { AppEmployeeProvider } from './context/AppEmployeeContext';
import { AppLanguageProvider } from './context/AppLanguageContext';
import { AppSettingsProvider } from './context/AppSettingsContext';
import { PortalAuthProvider, usePortalAuth } from './context/PortalAuthContext';
import type { PortalPage } from './types/app';
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

const AppShell = React.lazy(() => import('./components/AppShell').then((module) => ({ default: module.AppShell })));
const AppLanding = React.lazy(() => import('./pages/AppLanding').then((module) => ({ default: module.AppLanding })));
const AppCheckIn = React.lazy(() => import('./pages/AppCheckIn').then((module) => ({ default: module.AppCheckIn })));
const AppSelfProfile = React.lazy(() => import('./pages/AppSelfProfile').then((module) => ({ default: module.AppSelfProfile })));
const AdminLoginPage = React.lazy(() => import('./pages/AdminLoginPage').then((module) => ({ default: module.AdminLoginPage })));
const AppDashboard = React.lazy(() => import('./pages/AppDashboard').then((module) => ({ default: module.AppDashboard })));
const AppAttendance = React.lazy(() => import('./pages/AppAttendance').then((module) => ({ default: module.AppAttendance })));
const AppReports = React.lazy(() => import('./pages/AppReports').then((module) => ({ default: module.AppReports })));
const AppEmployees = React.lazy(() => import('./pages/AppEmployees').then((module) => ({ default: module.AppEmployees })));
const AppProfileRequests = React.lazy(() => import('./pages/AppProfileRequests').then((module) => ({ default: module.AppProfileRequests })));
const AppSettings = React.lazy(() => import('./pages/AppSettings').then((module) => ({ default: module.AppSettings })));
const AppKiosk = React.lazy(() => import('./pages/AppKiosk').then((module) => ({ default: module.AppKiosk })));
const AppAdmins = React.lazy(() => import('./pages/AppAdmins').then((module) => ({ default: module.AppAdmins })));

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

const AppLoadingFallback: React.FC = () => {
    return (
        <div className="auth-screen">
            <div className="auth-card reveal-up">
                <h2>Loading...</h2>
                <p>Please wait.</p>
            </div>
        </div>
    );
};

interface AppContentProps {
    route: AppRouteState;
    navigate: (next: AppRouteState) => void;
}

const AppContent: React.FC<AppContentProps> = ({ route, navigate }) => {
    const { portalUser, loginPortal, logoutPortal } = usePortalAuth();

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
                    onLogin={async (username, password) => {
                        const result = await loginPortal(username, password);
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
                onLogin={async (username, password) => {
                    const result = await loginPortal(username, password);
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
                onLogin={async (username, password) => {
                    const result = await loginPortal(username, password);
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
            {portalPage === 'reports' ? <AppReports /> : null}
            {portalPage === 'employees' ? <AppEmployees /> : null}
            {portalPage === 'requests' ? <AppProfileRequests /> : null}
            {portalPage === 'settings' ? <AppSettings /> : null}
            {portalPage === 'admins' ? <AppAdmins /> : null}
        </AppShell>
    );
};

function App() {
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

    const settingsEnabled = route.view === 'checkin'
        || route.view === 'employee-profile'
        || route.view === 'kiosk'
        || route.view === 'portal';
    const employeesEnabled = route.view === 'checkin'
        || route.view === 'employee-profile'
        || (route.view === 'portal' && route.portalPage !== 'admins' && route.portalPage !== 'settings');
    const portalSyncEnabled = route.view === 'portal' || route.view === 'kiosk';

    return (
        <AppLanguageProvider>
            <AppSettingsProvider enabled={settingsEnabled}>
                <AppEmployeeProvider enabled={employeesEnabled}>
                    <PortalAuthProvider enabled={portalSyncEnabled}>
                        <Suspense fallback={<AppLoadingFallback />}>
                            <AppContent route={route} navigate={navigate} />
                        </Suspense>
                    </PortalAuthProvider>
                </AppEmployeeProvider>
            </AppSettingsProvider>
        </AppLanguageProvider>
    );
}

export default App;
