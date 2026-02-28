import type { PortalPage } from '../types/app';

export type RootView = 'landing' | 'checkin' | 'kiosk' | 'employee-profile' | 'admin-login' | 'portal';
export type LoginNext = PortalPage | 'kiosk';

export interface AppRouteState {
    view: RootView;
    portalPage: PortalPage;
    loginNext: LoginNext;
}

const DEFAULT_PORTAL_PAGE: PortalPage = 'dashboard';

const VALID_PAGES = new Set<PortalPage>([
    'dashboard',
    'attendance',
    'reports',
    'employees',
    'requests',
    'settings',
    'admins',
]);

const normalizePage = (value: string | null | undefined): PortalPage => {
    if (!value) {
        return DEFAULT_PORTAL_PAGE;
    }
    return VALID_PAGES.has(value as PortalPage) ? (value as PortalPage) : DEFAULT_PORTAL_PAGE;
};

const normalizeLoginNext = (value: string | null | undefined): LoginNext => {
    if (value === 'kiosk') {
        return 'kiosk';
    }
    return normalizePage(value);
};

export const parseHashRoute = (hash: string): AppRouteState => {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    const [pathRaw, queryRaw = ''] = raw.split('?');
    const path = pathRaw || '/';
    const segments = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    const params = new URLSearchParams(queryRaw);

    if (segments.length === 0) {
        return { view: 'landing', portalPage: DEFAULT_PORTAL_PAGE, loginNext: DEFAULT_PORTAL_PAGE };
    }

    if (segments[0] === 'checkin') {
        return { view: 'checkin', portalPage: DEFAULT_PORTAL_PAGE, loginNext: DEFAULT_PORTAL_PAGE };
    }

    if (segments[0] === 'kiosk') {
        return { view: 'kiosk', portalPage: DEFAULT_PORTAL_PAGE, loginNext: 'kiosk' };
    }

    if (segments[0] === 'employee-profile') {
        return { view: 'employee-profile', portalPage: DEFAULT_PORTAL_PAGE, loginNext: DEFAULT_PORTAL_PAGE };
    }

    if (segments[0] === 'admin-login') {
        const next = normalizeLoginNext(params.get('next'));
        return {
            view: 'admin-login',
            portalPage: next === 'kiosk' ? DEFAULT_PORTAL_PAGE : next,
            loginNext: next,
        };
    }

    if (segments[0] === 'portal') {
        const page = normalizePage(segments[1]);
        return { view: 'portal', portalPage: page, loginNext: page };
    }

    return { view: 'landing', portalPage: DEFAULT_PORTAL_PAGE, loginNext: DEFAULT_PORTAL_PAGE };
};

export const buildLandingHash = (): string => '#/';

export const buildCheckInHash = (): string => '#/checkin';

export const buildKioskHash = (): string => '#/kiosk';

export const buildEmployeeProfileHash = (): string => '#/employee-profile';

export const buildAdminLoginHash = (next: LoginNext = DEFAULT_PORTAL_PAGE): string => `#/admin-login?next=${next}`;

export const buildPortalHash = (page: PortalPage = DEFAULT_PORTAL_PAGE): string => `#/portal/${page}`;
