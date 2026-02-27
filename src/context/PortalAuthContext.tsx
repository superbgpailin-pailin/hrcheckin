/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PortalUser } from '../types/app';

interface LoginResult {
    success: boolean;
    message?: string;
}

interface AddPortalAdminInput {
    username: string;
    displayName: string;
    password: string;
}

interface AddPortalAdminResult {
    success: boolean;
    message?: string;
}

interface PortalAuthContextValue {
    portalUser: PortalUser | null;
    portalAdmins: PortalUser[];
    loginPortal: (username: string, password: string) => LoginResult;
    logoutPortal: () => void;
    addPortalAdmin: (input: AddPortalAdminInput) => AddPortalAdminResult;
}

interface PortalAccount extends PortalUser {
    password: string;
    active: boolean;
}

const STORAGE_KEY_CURRENT_USER = 'hrcheckin_portal_user_v3';
const STORAGE_KEY_ACCOUNTS = 'hrcheckin_portal_accounts_v3';

const MASTER_ACCOUNT: PortalAccount = {
    username: 'master',
    displayName: 'Master Admin',
    role: 'Master',
    photoUrl: 'https://ui-avatars.com/api/?name=Master+Admin&background=0f172a&color=fff',
    password: '!master',
    active: true,
};

const normalizeUsername = (value: string): string => value.trim().toLowerCase();

const toPortalUser = (account: PortalAccount): PortalUser => {
    return {
        username: account.username,
        displayName: account.displayName,
        role: account.role,
        photoUrl: account.photoUrl,
    };
};

const ensureMasterAccount = (accounts: PortalAccount[]): PortalAccount[] => {
    const withoutMaster = accounts.filter((account) => normalizeUsername(account.username) !== 'master');
    return [MASTER_ACCOUNT, ...withoutMaster];
};

const parseStoredAccounts = (): PortalAccount[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
        if (!raw) {
            return [MASTER_ACCOUNT];
        }

        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [MASTER_ACCOUNT];
        }

        const mapped = parsed
            .map((item): PortalAccount | null => {
                if (!item || typeof item !== 'object') {
                    return null;
                }

                const username = normalizeUsername(String((item as { username?: unknown }).username || ''));
                const displayName = String((item as { displayName?: unknown }).displayName || '');
                const role = String((item as { role?: unknown }).role || 'Admin');
                const photoUrl = String((item as { photoUrl?: unknown }).photoUrl || '');
                const password = String((item as { password?: unknown }).password || '');
                const active = Boolean((item as { active?: unknown }).active ?? true);

                if (!username || !password) {
                    return null;
                }

                if (role !== 'Master' && role !== 'Admin') {
                    return null;
                }

                return {
                    username,
                    displayName: displayName || username.toUpperCase(),
                    role,
                    photoUrl: photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1e3a8a&color=fff`,
                    password,
                    active,
                };
            })
            .filter((item): item is PortalAccount => Boolean(item));

        return ensureMasterAccount(mapped);
    } catch {
        return [MASTER_ACCOUNT];
    }
};

const persistAccounts = (accounts: PortalAccount[]): void => {
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(ensureMasterAccount(accounts)));
};

const PortalAuthContext = createContext<PortalAuthContextValue | undefined>(undefined);

export const PortalAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [accounts, setAccounts] = useState<PortalAccount[]>(() => parseStoredAccounts());
    const [portalUsername, setPortalUsername] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_CURRENT_USER));

    const portalUser = useMemo<PortalUser | null>(() => {
        if (!portalUsername) {
            return null;
        }

        const target = accounts.find((account) => normalizeUsername(account.username) === normalizeUsername(portalUsername));
        if (!target || !target.active) {
            return null;
        }

        return toPortalUser(target);
    }, [accounts, portalUsername]);

    const portalAdmins = useMemo<PortalUser[]>(() => {
        return accounts
            .filter((account) => account.active)
            .map(toPortalUser);
    }, [accounts]);

    const loginPortal = useCallback((username: string, password: string): LoginResult => {
        const normalized = normalizeUsername(username);
        const account = accounts.find((item) => normalizeUsername(item.username) === normalized);

        if (!account) {
            return { success: false, message: 'ไม่พบบัญชีผู้ดูแลระบบ' };
        }

        if (!account.active) {
            return { success: false, message: 'บัญชีถูกระงับการใช้งาน' };
        }

        if (account.password !== password) {
            return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
        }

        setPortalUsername(account.username);
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, account.username);
        return { success: true };
    }, [accounts]);

    const logoutPortal = useCallback((): void => {
        setPortalUsername(null);
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    }, []);

    const addPortalAdmin = useCallback((input: AddPortalAdminInput): AddPortalAdminResult => {
        if (!portalUser || portalUser.role !== 'Master') {
            return { success: false, message: 'เฉพาะ Master เท่านั้นที่เพิ่มแอดมินได้' };
        }

        const username = normalizeUsername(input.username);
        const displayName = input.displayName.trim();
        const password = input.password;

        if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
            return { success: false, message: 'Username ต้องเป็น a-z, 0-9, ., _, - และยาว 3-32 ตัวอักษร' };
        }

        if (password.length < 6) {
            return { success: false, message: 'รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร' };
        }

        const duplicated = accounts.some((account) => normalizeUsername(account.username) === username);
        if (duplicated) {
            return { success: false, message: 'Username นี้ถูกใช้งานแล้ว' };
        }

        const newAccount: PortalAccount = {
            username,
            displayName: displayName || username.toUpperCase(),
            role: 'Admin',
            photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName || username)}&background=1d4ed8&color=fff`,
            password,
            active: true,
        };

        setAccounts((prev) => {
            const next = ensureMasterAccount([...prev, newAccount]);
            persistAccounts(next);
            return next;
        });

        return { success: true, message: 'เพิ่มแอดมินเรียบร้อยแล้ว' };
    }, [accounts, portalUser]);

    const value = useMemo<PortalAuthContextValue>(() => {
        return {
            portalUser,
            portalAdmins,
            loginPortal,
            logoutPortal,
            addPortalAdmin,
        };
    }, [addPortalAdmin, loginPortal, logoutPortal, portalAdmins, portalUser]);

    return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
};

export const usePortalAuth = (): PortalAuthContextValue => {
    const context = useContext(PortalAuthContext);
    if (!context) {
        throw new Error('usePortalAuth must be used within PortalAuthProvider');
    }
    return context;
};
