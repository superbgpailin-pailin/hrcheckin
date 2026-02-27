/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
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

interface UpdatePortalAdminInput {
    username: string;
    displayName: string;
    password?: string;
}

interface UpdatePortalAdminResult {
    success: boolean;
    message?: string;
}

interface DeletePortalAdminResult {
    success: boolean;
    message?: string;
}

interface ChangeOwnPasswordInput {
    currentPassword: string;
    newPassword: string;
}

interface ChangeOwnPasswordResult {
    success: boolean;
    message?: string;
}

interface PortalAuthContextValue {
    portalUser: PortalUser | null;
    portalAdmins: PortalUser[];
    loginPortal: (username: string, password: string) => LoginResult;
    logoutPortal: () => void;
    addPortalAdmin: (input: AddPortalAdminInput) => Promise<AddPortalAdminResult>;
    updatePortalAdmin: (input: UpdatePortalAdminInput) => Promise<UpdatePortalAdminResult>;
    deletePortalAdmin: (username: string) => Promise<DeletePortalAdminResult>;
    changeOwnPassword: (input: ChangeOwnPasswordInput) => Promise<ChangeOwnPasswordResult>;
}

interface PortalAccount extends PortalUser {
    password: string;
    active: boolean;
}

interface PortalAccountRow {
    username: string;
    display_name: string | null;
    role: string | null;
    photo_url: string | null;
    password: string | null;
    active: boolean | null;
}

const STORAGE_KEY_CURRENT_USER = 'hrcheckin_portal_user_v3';
const STORAGE_KEY_ACCOUNTS = 'hrcheckin_portal_accounts_v3';
const ACCOUNTS_TABLE = 'portal_admin_accounts';

let accountsTableUnavailable = false;

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

const isSchemaMissingError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('could not find the table')
        || normalized.includes('schema cache')
        || normalized.includes('does not exist');
};

const ensureMasterAccount = (accounts: PortalAccount[]): PortalAccount[] => {
    const existingMaster = accounts.find((account) => normalizeUsername(account.username) === 'master');
    const masterAccount: PortalAccount = existingMaster
        ? {
            ...MASTER_ACCOUNT,
            ...existingMaster,
            username: 'master',
            role: 'Master',
            active: true,
        }
        : MASTER_ACCOUNT;

    const withoutMaster = accounts.filter((account) => normalizeUsername(account.username) !== 'master');
    return [masterAccount, ...withoutMaster];
};

const readStoredAccounts = (): PortalAccount[] => {
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

const fromRow = (row: PortalAccountRow): PortalAccount | null => {
    const username = normalizeUsername(row.username);
    const password = String(row.password || '');
    if (!username || !password) {
        return null;
    }

    const role = row.role === 'Master' ? 'Master' : 'Admin';
    const displayName = String(row.display_name || username.toUpperCase());
    const photoUrl = String(row.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e3a8a&color=fff`);

    return {
        username,
        displayName,
        role,
        photoUrl,
        password,
        active: Boolean(row.active ?? true),
    };
};

const toInsertRow = (account: PortalAccount): Record<string, string | boolean> => {
    return {
        username: normalizeUsername(account.username),
        display_name: account.displayName,
        role: account.role,
        photo_url: account.photoUrl,
        password: account.password,
        active: account.active,
    };
};

const dedupeAccounts = (accounts: PortalAccount[]): PortalAccount[] => {
    const map = new Map<string, PortalAccount>();
    accounts.forEach((account) => {
        map.set(normalizeUsername(account.username), account);
    });
    return ensureMasterAccount(Array.from(map.values()));
};

const fetchRemoteAccounts = async (): Promise<PortalAccount[]> => {
    const { data, error } = await supabase
        .from(ACCOUNTS_TABLE)
        .select('username, display_name, role, photo_url, password, active')
        .order('username', { ascending: true });

    if (error) {
        throw error;
    }

    return ((data as PortalAccountRow[]) || [])
        .map(fromRow)
        .filter((item): item is PortalAccount => Boolean(item));
};

const insertRemoteAccount = async (account: PortalAccount): Promise<void> => {
    const { error } = await supabase
        .from(ACCOUNTS_TABLE)
        .insert([toInsertRow(account)]);

    if (error) {
        throw error;
    }
};

const updateRemoteAccountPassword = async (username: string, password: string): Promise<void> => {
    const { error } = await supabase
        .from(ACCOUNTS_TABLE)
        .update({ password })
        .eq('username', normalizeUsername(username));

    if (error) {
        throw error;
    }
};

const updateRemoteAccount = async (username: string, payload: Record<string, string>): Promise<void> => {
    const { error } = await supabase
        .from(ACCOUNTS_TABLE)
        .update(payload)
        .eq('username', normalizeUsername(username));

    if (error) {
        throw error;
    }
};

const deleteRemoteAccount = async (username: string): Promise<void> => {
    const { error } = await supabase
        .from(ACCOUNTS_TABLE)
        .delete()
        .eq('username', normalizeUsername(username));

    if (error) {
        throw error;
    }
};

const PortalAuthContext = createContext<PortalAuthContextValue | undefined>(undefined);

export const PortalAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [accounts, setAccounts] = useState<PortalAccount[]>(() => readStoredAccounts());
    const [portalUsername, setPortalUsername] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_CURRENT_USER));

    const reloadAccounts = useCallback(async (): Promise<void> => {
        if (accountsTableUnavailable) {
            const localAccounts = dedupeAccounts(readStoredAccounts());
            setAccounts(localAccounts);
            persistAccounts(localAccounts);
            return;
        }

        const localAccounts = dedupeAccounts(readStoredAccounts());

        try {
            let remoteAccounts = dedupeAccounts(await fetchRemoteAccounts());

            const remoteUsernames = new Set(remoteAccounts.map((account) => normalizeUsername(account.username)));
            const missingFromRemote = localAccounts.filter((account) => {
                const normalized = normalizeUsername(account.username);
                return normalized !== 'master' && !remoteUsernames.has(normalized);
            });

            if (missingFromRemote.length > 0) {
                for (const account of missingFromRemote) {
                    try {
                        await insertRemoteAccount(account);
                    } catch {
                        // Keep loading flow resilient; duplicate/errors are handled by next fetch.
                    }
                }
                remoteAccounts = dedupeAccounts(await fetchRemoteAccounts());
            }

            const merged = dedupeAccounts([...remoteAccounts, ...localAccounts]);
            setAccounts(merged);
            persistAccounts(merged);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error || '');
            if (isSchemaMissingError(message)) {
                accountsTableUnavailable = true;
            }

            const fallback = dedupeAccounts(localAccounts);
            setAccounts(fallback);
            persistAccounts(fallback);
        }
    }, []);

    useEffect(() => {
        void reloadAccounts();
    }, [reloadAccounts]);

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

    const addPortalAdmin = useCallback(async (input: AddPortalAdminInput): Promise<AddPortalAdminResult> => {
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

        if (!accountsTableUnavailable) {
            try {
                await insertRemoteAccount(newAccount);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error || '');
                if (isSchemaMissingError(message)) {
                    accountsTableUnavailable = true;
                } else if (message.toLowerCase().includes('duplicate key')) {
                    return { success: false, message: 'Username นี้ถูกใช้งานแล้ว' };
                } else {
                    return { success: false, message };
                }
            }
        }

        const next = dedupeAccounts([...accounts, newAccount]);
        setAccounts(next);
        persistAccounts(next);
        await reloadAccounts();
        return { success: true, message: 'เพิ่มแอดมินเรียบร้อยแล้ว' };
    }, [accounts, portalUser, reloadAccounts]);

    const updatePortalAdmin = useCallback(async (input: UpdatePortalAdminInput): Promise<UpdatePortalAdminResult> => {
        if (!portalUser || portalUser.role !== 'Master') {
            return { success: false, message: 'Only master can edit admin accounts.' };
        }

        const username = normalizeUsername(input.username);
        if (!username) {
            return { success: false, message: 'Username is required.' };
        }
        if (username === 'master') {
            return { success: false, message: 'Master account cannot be edited here.' };
        }

        const target = accounts.find((account) => normalizeUsername(account.username) === username);
        if (!target) {
            return { success: false, message: 'Admin account not found.' };
        }

        const displayName = input.displayName.trim();
        if (!displayName) {
            return { success: false, message: 'Display name is required.' };
        }

        const nextPassword = (input.password || '').trim();
        if (nextPassword && nextPassword.length < 6) {
            return { success: false, message: 'Password must be at least 6 characters.' };
        }

        const nextPhotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1d4ed8&color=fff`;
        if (!accountsTableUnavailable) {
            try {
                const remotePayload: Record<string, string> = {
                    display_name: displayName,
                    photo_url: nextPhotoUrl,
                };
                if (nextPassword) {
                    remotePayload.password = nextPassword;
                }
                await updateRemoteAccount(username, remotePayload);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error || '');
                if (isSchemaMissingError(message)) {
                    accountsTableUnavailable = true;
                } else {
                    return { success: false, message };
                }
            }
        }

        const next = accounts.map((account) => {
            if (normalizeUsername(account.username) !== username) {
                return account;
            }
            return {
                ...account,
                displayName,
                photoUrl: nextPhotoUrl,
                password: nextPassword || account.password,
            };
        });

        const deduped = dedupeAccounts(next);
        setAccounts(deduped);
        persistAccounts(deduped);
        return { success: true, message: 'Admin updated successfully.' };
    }, [accounts, portalUser]);

    const deletePortalAdmin = useCallback(async (usernameInput: string): Promise<DeletePortalAdminResult> => {
        if (!portalUser || portalUser.role !== 'Master') {
            return { success: false, message: 'Only master can delete admin accounts.' };
        }

        const username = normalizeUsername(usernameInput);
        if (!username) {
            return { success: false, message: 'Username is required.' };
        }
        if (username === 'master') {
            return { success: false, message: 'Master account cannot be deleted.' };
        }
        if (normalizeUsername(portalUser.username) === username) {
            return { success: false, message: 'Cannot delete the current signed-in account.' };
        }

        const target = accounts.find((account) => normalizeUsername(account.username) === username);
        if (!target) {
            return { success: false, message: 'Admin account not found.' };
        }

        if (!accountsTableUnavailable) {
            try {
                await deleteRemoteAccount(username);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error || '');
                if (isSchemaMissingError(message)) {
                    accountsTableUnavailable = true;
                } else {
                    return { success: false, message };
                }
            }
        }

        const next = accounts.filter((account) => normalizeUsername(account.username) !== username);
        const deduped = dedupeAccounts(next);
        setAccounts(deduped);
        persistAccounts(deduped);
        return { success: true, message: 'Admin deleted successfully.' };
    }, [accounts, portalUser]);

    const changeOwnPassword = useCallback(async (input: ChangeOwnPasswordInput): Promise<ChangeOwnPasswordResult> => {
        if (!portalUser) {
            return { success: false, message: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' };
        }

        const currentPassword = input.currentPassword;
        const newPassword = input.newPassword;
        const accountIndex = accounts.findIndex((account) => normalizeUsername(account.username) === normalizeUsername(portalUser.username));
        if (accountIndex < 0) {
            return { success: false, message: 'ไม่พบบัญชีผู้ใช้' };
        }

        const currentAccount = accounts[accountIndex];
        if (currentAccount.password !== currentPassword) {
            return { success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' };
        }

        if (newPassword.length < 6) {
            return { success: false, message: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร' };
        }

        if (newPassword === currentPassword) {
            return { success: false, message: 'รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม' };
        }

        if (!accountsTableUnavailable) {
            try {
                await updateRemoteAccountPassword(currentAccount.username, newPassword);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error || '');
                if (isSchemaMissingError(message)) {
                    accountsTableUnavailable = true;
                } else {
                    return { success: false, message };
                }
            }
        }

        const next = accounts.map((account, index) => {
            if (index !== accountIndex) {
                return account;
            }
            return {
                ...account,
                password: newPassword,
            };
        });

        const deduped = dedupeAccounts(next);
        setAccounts(deduped);
        persistAccounts(deduped);
        return { success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' };
    }, [accounts, portalUser]);

    const value = useMemo<PortalAuthContextValue>(() => {
        return {
            portalUser,
            portalAdmins,
            loginPortal,
            logoutPortal,
            addPortalAdmin,
            updatePortalAdmin,
            deletePortalAdmin,
            changeOwnPassword,
        };
    }, [addPortalAdmin, changeOwnPassword, deletePortalAdmin, loginPortal, logoutPortal, portalAdmins, portalUser, updatePortalAdmin]);

    return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
};

export const usePortalAuth = (): PortalAuthContextValue => {
    const context = useContext(PortalAuthContext);
    if (!context) {
        throw new Error('usePortalAuth must be used within PortalAuthProvider');
    }
    return context;
};
