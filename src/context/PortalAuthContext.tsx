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
    loginPortal: (username: string, password: string) => Promise<LoginResult>;
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

interface PortalAccountListRow {
    username: string;
    display_name: string | null;
    role: string | null;
    photo_url: string | null;
    active: boolean | null;
}

interface PortalAuthApiAccount {
    username: string;
    displayName: string;
    role: 'Master' | 'Admin';
    photoUrl: string;
    active: boolean;
}

interface PortalAuthApiResponse {
    success: boolean;
    message?: string;
    code?: string;
    account?: PortalAuthApiAccount;
    sessionToken?: string;
}

// Cached shape — no password stored to localStorage
interface CachedPortalAccount {
    username: string;
    displayName: string;
    role: 'Master' | 'Admin';
    photoUrl: string;
    active: boolean;
}

const STORAGE_KEY_CURRENT_USER = 'hrcheckin_portal_user_v3';
const STORAGE_KEY_SESSION_TOKEN = 'hrcheckin_portal_session_v1';
const STORAGE_KEY_ACCOUNTS = 'hrcheckin_portal_accounts_v4'; // bumped — old v3 had passwords
const ACCOUNTS_TABLE = 'portal_admin_accounts';
const PORTAL_AUTH_API_ENDPOINT = '/api/portal-admin-auth';
const PORTAL_AUTH_API_UNAVAILABLE_CODE = 'api_unavailable';
const PORTAL_AUTH_API_UNAUTHORIZED_CODE = 'api_unauthorized';
const PORTAL_AUTH_API_RETRY_MESSAGE = 'บริการยืนยันตัวตนไม่พร้อมใช้งาน โปรดลองอีกครั้ง';

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

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'object' && error && 'message' in error) {
        return String((error as { message?: unknown }).message || '');
    }

    return String(error || '');
};

const createPortalAuthApiError = (message: string, code: string): Error & { code: string } => {
    const error = new Error(message) as Error & { code: string };
    error.code = code;
    return error;
};

const getPortalAuthApiErrorCode = (error: unknown): string => {
    if (typeof error === 'object' && error && 'code' in error) {
        return String((error as { code?: unknown }).code || '');
    }
    return '';
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

// --- localStorage: store only non-sensitive cached accounts (no password) ---

const toCached = (account: PortalAccount): CachedPortalAccount => ({
    username: account.username,
    displayName: account.displayName,
    role: account.role as 'Master' | 'Admin',
    photoUrl: account.photoUrl,
    active: account.active,
});

const readStoredAccounts = (): PortalAccount[] => {
    try {
        // Also clear the old v3 key that stored passwords
        localStorage.removeItem('hrcheckin_portal_accounts_v3');

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
                const active = Boolean((item as { active?: unknown }).active ?? true);

                if (!username) {
                    return null;
                }

                if (role !== 'Master' && role !== 'Admin') {
                    return null;
                }

                // Password not stored in cache; will be fetched from remote on login
                return {
                    username,
                    displayName: displayName || username.toUpperCase(),
                    role: role as 'Master' | 'Admin',
                    photoUrl: photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1e3a8a&color=fff`,
                    password: '',
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
    // Only cache non-sensitive fields — passwords are NOT stored
    const safeAccounts = ensureMasterAccount(accounts).map(toCached);
    localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(safeAccounts));
};


const fromRow = (
    row: PortalAccountRow | PortalAccountListRow,
    options: { requirePassword?: boolean } = {},
): PortalAccount | null => {
    const username = normalizeUsername(row.username);
    const password = 'password' in row ? String(row.password || '') : '';
    const requirePassword = options.requirePassword ?? false;
    if (!username || (requirePassword && !password)) {
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
        const key = normalizeUsername(account.username);
        const existing = map.get(key);
        if (!existing) {
            map.set(key, account);
            return;
        }

        map.set(key, {
            ...existing,
            ...account,
            password: account.password || existing.password,
        });
    });
    return ensureMasterAccount(Array.from(map.values()));
};

const fromApiAccount = (account: PortalAuthApiAccount): PortalAccount => {
    return {
        username: normalizeUsername(account.username),
        displayName: String(account.displayName || account.username.toUpperCase()),
        role: account.role === 'Master' ? 'Master' : 'Admin',
        photoUrl: String(account.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(account.displayName || account.username)}&background=1e3a8a&color=fff`),
        password: '',
        active: Boolean(account.active),
    };
};

const requestPortalAuthApi = async (
    payload: Record<string, unknown>,
    sessionToken?: string | null,
): Promise<PortalAuthApiResponse> => {
    let response: Response;
    try {
        response = await fetch(PORTAL_AUTH_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
            },
            body: JSON.stringify(payload),
        });
    } catch {
        throw createPortalAuthApiError('ไม่สามารถเชื่อมต่อบริการยืนยันตัวตนได้', PORTAL_AUTH_API_UNAVAILABLE_CODE);
    }

    if (response.status === 404 || response.status === 405) {
        throw createPortalAuthApiError('บริการยืนยันตัวตนไม่พร้อมใช้งาน', PORTAL_AUTH_API_UNAVAILABLE_CODE);
    }

    let result: PortalAuthApiResponse = { success: false, message: 'ไม่สามารถอ่านผลลัพธ์จากบริการยืนยันตัวตน' };
    try {
        result = await response.json() as PortalAuthApiResponse;
    } catch {
        // Keep fallback result message above
    }

    const message = String(result.message || 'ไม่สามารถทำรายการได้');
    if (!response.ok || !result.success) {
        const code = String(result.code || '');
        if (response.status === 401 || code === 'unauthorized' || code.startsWith('token_')) {
            throw createPortalAuthApiError(message, PORTAL_AUTH_API_UNAUTHORIZED_CODE);
        }
        throw createPortalAuthApiError(message, code || 'api_error');
    }

    return result;
};

const fetchRemoteAccounts = async (): Promise<PortalAccount[]> => {
    const { data, error } = await supabase
        .from(ACCOUNTS_TABLE)
        .select('username, display_name, role, photo_url, active')
        .order('username', { ascending: true });

    if (error) {
        throw error;
    }

    return ((data as PortalAccountListRow[]) || [])
        .map((row) => fromRow(row))
        .filter((item): item is PortalAccount => Boolean(item));
};

const fetchRemoteAccountByUsername = async (username: string): Promise<PortalAccount | null> => {
    const { data, error } = await supabase
        .from(ACCOUNTS_TABLE)
        .select('username, display_name, role, photo_url, password, active')
        .eq('username', normalizeUsername(username))
        .limit(1);

    if (error) {
        throw error;
    }

    const rows = (data as PortalAccountRow[] | null) || [];
    const mapped = rows
        .map((row) => fromRow(row, { requirePassword: true }))
        .filter((item): item is PortalAccount => Boolean(item));

    return mapped[0] || null;
};

const insertRemoteAccount = async (account: PortalAccount): Promise<void> => {
    const { error } = await supabase
        .from(ACCOUNTS_TABLE)
        .insert([toInsertRow(account)]);

    if (error) {
        throw error;
    }
};

const updateRemoteAccount = async (username: string, payload: Record<string, string>): Promise<number> => {
    const { error, count } = await supabase
        .from(ACCOUNTS_TABLE)
        .update(payload, { count: 'exact' })
        .eq('username', normalizeUsername(username));

    if (error) {
        throw error;
    }

    return typeof count === 'number' ? count : 0;
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

interface PortalAuthProviderProps {
    children: React.ReactNode;
    enabled?: boolean;
}

export const PortalAuthProvider: React.FC<PortalAuthProviderProps> = ({ children, enabled = true }) => {
    const [accounts, setAccounts] = useState<PortalAccount[]>(() => readStoredAccounts());
    const [portalUsername, setPortalUsername] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_CURRENT_USER));
    const [portalSessionToken, setPortalSessionToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY_SESSION_TOKEN));

    const clearPortalSession = useCallback(() => {
        setPortalUsername(null);
        setPortalSessionToken(null);
        localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
        localStorage.removeItem(STORAGE_KEY_SESSION_TOKEN);
    }, []);

    const setPortalSession = useCallback((username: string, sessionToken: string | null) => {
        setPortalUsername(username);
        setPortalSessionToken(sessionToken);
        localStorage.setItem(STORAGE_KEY_CURRENT_USER, username);
        if (sessionToken) {
            localStorage.setItem(STORAGE_KEY_SESSION_TOKEN, sessionToken);
        } else {
            localStorage.removeItem(STORAGE_KEY_SESSION_TOKEN);
        }
    }, []);

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
            // Only push local accounts that have a real password (i.e. created locally before remote sync)
            const missingFromRemote = localAccounts.filter((account) => {
                const normalized = normalizeUsername(account.username);
                return normalized !== 'master' && !remoteUsernames.has(normalized) && account.password !== '';
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

            // Remote is the source of truth for passwords and admin account state.
            // Merge: Combine local and remote. Dedupe will keep the last one (remote wins).
            const merged = dedupeAccounts([...localAccounts, ...remoteAccounts]);
            setAccounts(merged);
            persistAccounts(merged);
        } catch (error) {
            const message = getErrorMessage(error);
            if (isSchemaMissingError(message)) {
                accountsTableUnavailable = true;
            }

            const fallback = dedupeAccounts(localAccounts);
            setAccounts(fallback);
            persistAccounts(fallback);
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        // We intentionally trigger the async account refresh once when auth is enabled.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void reloadAccounts();
    }, [enabled, reloadAccounts]);

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

    const legacyLoginPortal = useCallback(async (username: string, password: string): Promise<LoginResult> => {
        const normalized = normalizeUsername(username);

        if (!accountsTableUnavailable) {
            try {
                const remoteAccount = await fetchRemoteAccountByUsername(normalized);
                if (!remoteAccount) {
                    return { success: false, message: 'ไม่พบบัญชีผู้ดูแลระบบ' };
                }

                const nextAccounts = dedupeAccounts([
                    ...accounts.filter((item) => normalizeUsername(item.username) !== normalized),
                    remoteAccount,
                ]);
                setAccounts(nextAccounts);
                persistAccounts(nextAccounts);

                if (!remoteAccount.active) {
                    return { success: false, message: 'บัญชีถูกระงับการใช้งาน' };
                }

                if (remoteAccount.password.startsWith('scrypt$')) {
                    return { success: false, message: 'ระบบยืนยันตัวตนฝั่งเซิร์ฟเวอร์ไม่พร้อมใช้งาน โปรดติดต่อผู้ดูแลระบบ' };
                }

                if (remoteAccount.password !== password) {
                    return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
                }

                return { success: true };
            } catch (error) {
                const message = getErrorMessage(error);
                if (isSchemaMissingError(message)) {
                    accountsTableUnavailable = true;
                } else {
                    return { success: false, message };
                }
            }
        }

        const account = accounts.find((item) => normalizeUsername(item.username) === normalized);
        if (!account) {
            return { success: false, message: 'ไม่พบบัญชีผู้ดูแลระบบ' };
        }

        if (!account.active) {
            return { success: false, message: 'บัญชีถูกระงับการใช้งาน' };
        }

        if (account.password.startsWith('scrypt$')) {
            return { success: false, message: 'ระบบยืนยันตัวตนฝั่งเซิร์ฟเวอร์ไม่พร้อมใช้งาน โปรดติดต่อผู้ดูแลระบบ' };
        }

        if (account.password !== password) {
            return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
        }

        return { success: true };
    }, [accounts]);

    const loginPortal = useCallback(async (username: string, password: string): Promise<LoginResult> => {
        const normalized = normalizeUsername(username);
        const passwordInput = String(password || '');

        if (!normalized || !passwordInput) {
            return { success: false, message: 'กรุณาระบุ Username และ Password' };
        }

        try {
            const apiResult = await requestPortalAuthApi({
                action: 'login',
                username: normalized,
                password: passwordInput,
            });

            if (!apiResult.account || !apiResult.sessionToken) {
                return { success: false, message: 'ผลลัพธ์จากระบบยืนยันตัวตนไม่สมบูรณ์' };
            }

            const authenticatedAccount = fromApiAccount(apiResult.account);
            const nextAccounts = dedupeAccounts([
                ...accounts.filter((item) => normalizeUsername(item.username) !== normalized),
                authenticatedAccount,
            ]);
            setAccounts(nextAccounts);
            persistAccounts(nextAccounts);
            setPortalSession(authenticatedAccount.username, apiResult.sessionToken);
            await reloadAccounts();
            return { success: true, message: apiResult.message };
        } catch (error) {
            const apiErrorCode = getPortalAuthApiErrorCode(error);
            if (apiErrorCode && apiErrorCode !== PORTAL_AUTH_API_UNAVAILABLE_CODE) {
                return { success: false, message: getErrorMessage(error) };
            }
        }

        const fallbackResult = await legacyLoginPortal(normalized, passwordInput);
        if (fallbackResult.success) {
            setPortalSession(normalized, null);
        }
        return fallbackResult;
    }, [accounts, legacyLoginPortal, reloadAccounts, setPortalSession]);

    const logoutPortal = useCallback((): void => {
        clearPortalSession();
    }, [clearPortalSession]);

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

        try {
            const apiResult = await requestPortalAuthApi(
                {
                    action: 'add_admin',
                    username,
                    displayName,
                    password,
                },
                portalSessionToken,
            );
            await reloadAccounts();
            return { success: true, message: apiResult.message || 'เพิ่มแอดมินเรียบร้อยแล้ว' };
        } catch (error) {
            const apiErrorCode = getPortalAuthApiErrorCode(error);
            if (apiErrorCode === PORTAL_AUTH_API_UNAUTHORIZED_CODE) {
                clearPortalSession();
                return { success: false, message: 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' };
            }
            if (apiErrorCode === PORTAL_AUTH_API_UNAVAILABLE_CODE) {
                return { success: false, message: PORTAL_AUTH_API_RETRY_MESSAGE };
            }
            return { success: false, message: getErrorMessage(error) || PORTAL_AUTH_API_RETRY_MESSAGE };
        }
    }, [accounts, clearPortalSession, portalSessionToken, portalUser, reloadAccounts]);

    const updatePortalAdmin = useCallback(async (input: UpdatePortalAdminInput): Promise<UpdatePortalAdminResult> => {
        if (!portalUser || portalUser.role !== 'Master') {
            return { success: false, message: 'เฉพาะ Master เท่านั้นที่แก้ไขบัญชีแอดมินได้' };
        }

        const username = normalizeUsername(input.username);
        if (!username) {
            return { success: false, message: 'กรุณาระบุ Username' };
        }
        if (username === 'master') {
            return { success: false, message: 'ไม่สามารถแก้ไขบัญชี Master ได้ที่นี่' };
        }

        const target = accounts.find((account) => normalizeUsername(account.username) === username);
        if (!target) {
            return { success: false, message: 'ไม่พบบัญชีแอดมินที่ต้องการแก้ไข' };
        }

        const displayName = input.displayName.trim();
        if (!displayName) {
            return { success: false, message: 'กรุณากรอกชื่อที่แสดง' };
        }

        const nextPassword = (input.password || '').trim();
        if (nextPassword && nextPassword.length < 6) {
            return { success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };
        }

        try {
            const apiResult = await requestPortalAuthApi(
                {
                    action: 'update_admin',
                    username,
                    displayName,
                    password: nextPassword || undefined,
                },
                portalSessionToken,
            );
            await reloadAccounts();
            return { success: true, message: apiResult.message || 'แก้ไขข้อมูลแอดมินเรียบร้อยแล้ว' };
        } catch (error) {
            const apiErrorCode = getPortalAuthApiErrorCode(error);
            if (apiErrorCode === PORTAL_AUTH_API_UNAUTHORIZED_CODE) {
                clearPortalSession();
                return { success: false, message: 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' };
            }
            if (apiErrorCode === PORTAL_AUTH_API_UNAVAILABLE_CODE && nextPassword) {
                return { success: false, message: PORTAL_AUTH_API_RETRY_MESSAGE };
            }
            if (apiErrorCode && apiErrorCode !== PORTAL_AUTH_API_UNAVAILABLE_CODE) {
                return { success: false, message: getErrorMessage(error) };
            }
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
                const updatedRows = await updateRemoteAccount(username, remotePayload);
                if (updatedRows < 1) {
                    return { success: false, message: 'ไม่พบแถวที่ต้องการอัพเดทบนเซิร์ฟเวอร์' };
                }
            } catch (error) {
                const message = getErrorMessage(error);
                if (isSchemaMissingError(message)) {
                    accountsTableUnavailable = true;
                } else if (message.toLowerCase().includes('duplicate key')) {
                    return { success: false, message: 'เซิร์ฟเวอร์ปฏิเสธการอัพเดท (key ซ้ำ)' };
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
        await reloadAccounts();
        return { success: true, message: 'แก้ไขข้อมูลแอดมินเรียบร้อยแล้ว' };
    }, [accounts, clearPortalSession, portalSessionToken, portalUser, reloadAccounts]);

    const deletePortalAdmin = useCallback(async (usernameInput: string): Promise<DeletePortalAdminResult> => {
        if (!portalUser || portalUser.role !== 'Master') {
            return { success: false, message: 'เฉพาะ Master เท่านั้นที่ลบบัญชีแอดมินได้' };
        }

        const username = normalizeUsername(usernameInput);
        if (!username) {
            return { success: false, message: 'กรุณาระบุ Username' };
        }
        if (username === 'master') {
            return { success: false, message: 'ไม่สามารถลบบัญชี Master ได้' };
        }
        if (normalizeUsername(portalUser.username) === username) {
            return { success: false, message: 'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้' };
        }

        const target = accounts.find((account) => normalizeUsername(account.username) === username);
        if (!target) {
            return { success: false, message: 'ไม่พบบัญชีแอดมินที่ต้องการลบ' };
        }

        try {
            const apiResult = await requestPortalAuthApi(
                {
                    action: 'delete_admin',
                    username,
                },
                portalSessionToken,
            );
            const next = accounts.filter((account) => normalizeUsername(account.username) !== username);
            const deduped = dedupeAccounts(next);
            setAccounts(deduped);
            persistAccounts(deduped);
            return { success: true, message: apiResult.message || 'ลบบัญชีแอดมินเรียบร้อยแล้ว' };
        } catch (error) {
            const apiErrorCode = getPortalAuthApiErrorCode(error);
            if (apiErrorCode === PORTAL_AUTH_API_UNAUTHORIZED_CODE) {
                clearPortalSession();
                return { success: false, message: 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' };
            }
            if (apiErrorCode && apiErrorCode !== PORTAL_AUTH_API_UNAVAILABLE_CODE) {
                return { success: false, message: getErrorMessage(error) };
            }
        }

        if (!accountsTableUnavailable) {
            try {
                await deleteRemoteAccount(username);
            } catch (error) {
                const message = getErrorMessage(error);
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
        return { success: true, message: 'ลบบัญชีแอดมินเรียบร้อยแล้ว' };
    }, [accounts, clearPortalSession, portalSessionToken, portalUser]);

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

        if (newPassword.length < 6) {
            return { success: false, message: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร' };
        }

        if (!currentPassword.trim()) {
            return { success: false, message: 'กรุณากรอกรหัสผ่านปัจจุบัน' };
        }

        if (newPassword === currentPassword) {
            return { success: false, message: 'รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม' };
        }

        try {
            const apiResult = await requestPortalAuthApi(
                {
                    action: 'change_own_password',
                    currentPassword,
                    newPassword,
                },
                portalSessionToken,
            );

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
            return { success: true, message: apiResult.message || 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' };
        } catch (error) {
            const apiErrorCode = getPortalAuthApiErrorCode(error);
            if (apiErrorCode === PORTAL_AUTH_API_UNAUTHORIZED_CODE) {
                clearPortalSession();
                return { success: false, message: 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' };
            }
            if (apiErrorCode === PORTAL_AUTH_API_UNAVAILABLE_CODE) {
                return { success: false, message: PORTAL_AUTH_API_RETRY_MESSAGE };
            }
            return { success: false, message: getErrorMessage(error) || PORTAL_AUTH_API_RETRY_MESSAGE };
        }
    }, [accounts, clearPortalSession, portalSessionToken, portalUser]);

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
