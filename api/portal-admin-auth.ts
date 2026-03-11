import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ACCOUNTS_TABLE = 'portal_admin_accounts';
const DEFAULT_MASTER_USERNAME = 'master';
const DEFAULT_MASTER_PASSWORD = '!master';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const PASSWORD_HASH_PREFIX = 'scrypt';
const PASSWORD_HASH_VERSION = 'v1';
const PASSWORD_SCRYPT_N = 16384;
const PASSWORD_SCRYPT_R = 8;
const PASSWORD_SCRYPT_P = 1;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_MAX_MEM = 64 * 1024 * 1024;

type PortalRole = 'Master' | 'Admin';

interface PortalAccountRow {
    username: string;
    display_name: string | null;
    role: string | null;
    photo_url: string | null;
    password: string | null;
    active: boolean | null;
}

interface PortalSessionPayload {
    username: string;
    role: PortalRole;
    iat: number;
    exp: number;
}

interface ApiRequest {
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
    body?: unknown;
}

interface ApiResponse {
    status: (code: number) => {
        json: (payload: unknown) => void;
    };
}

const normalizeUsername = (value: unknown): string => String(value || '').trim().toLowerCase();

const normalizeRole = (value: unknown): PortalRole => {
    return String(value || '') === 'Master' ? 'Master' : 'Admin';
};

const defaultPhotoUrl = (displayName: string, username: string): string => {
    const source = displayName.trim() || username;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(source)}&background=1d4ed8&color=fff`;
};

const isDuplicateError = (message: string, code?: string): boolean => {
    const normalized = String(message || '').toLowerCase();
    return code === '23505' || normalized.includes('duplicate key');
};

const base64UrlEncode = (value: Buffer | string): string => {
    return Buffer.from(value).toString('base64url');
};

const base64UrlDecode = (value: string): Buffer => {
    return Buffer.from(value, 'base64url');
};

const issueSessionToken = (payload: PortalSessionPayload, secret: string): string => {
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = createHmac('sha256', secret).update(encodedPayload).digest();
    return `${encodedPayload}.${base64UrlEncode(signature)}`;
};

const verifySessionToken = (
    token: string,
    secret: string,
): { valid: true; payload: PortalSessionPayload } | { valid: false; code: string; message: string } => {
    const [payloadPart, signaturePart] = token.split('.');
    if (!payloadPart || !signaturePart) {
        return { valid: false, code: 'token_invalid', message: 'เซสชันไม่ถูกต้อง' };
    }

    const expected = createHmac('sha256', secret).update(payloadPart).digest();
    let actual: Buffer;
    try {
        actual = base64UrlDecode(signaturePart);
    } catch {
        return { valid: false, code: 'token_invalid', message: 'เซสชันไม่ถูกต้อง' };
    }

    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        return { valid: false, code: 'token_invalid', message: 'เซสชันไม่ถูกต้อง' };
    }

    let payload: PortalSessionPayload;
    try {
        payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8')) as PortalSessionPayload;
    } catch {
        return { valid: false, code: 'token_invalid', message: 'เซสชันไม่ถูกต้อง' };
    }

    if (!payload.username || (payload.role !== 'Master' && payload.role !== 'Admin')) {
        return { valid: false, code: 'token_invalid', message: 'เซสชันไม่ถูกต้อง' };
    }

    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
        return { valid: false, code: 'token_expired', message: 'เซสชันหมดอายุ โปรดเข้าสู่ระบบใหม่' };
    }

    return { valid: true, payload };
};

const hashPassword = (plainPassword: string): string => {
    const salt = randomBytes(16);
    const derived = scryptSync(plainPassword, salt, PASSWORD_KEY_LENGTH, {
        N: PASSWORD_SCRYPT_N,
        r: PASSWORD_SCRYPT_R,
        p: PASSWORD_SCRYPT_P,
        maxmem: PASSWORD_MAX_MEM,
    });

    return [
        PASSWORD_HASH_PREFIX,
        PASSWORD_HASH_VERSION,
        String(PASSWORD_SCRYPT_N),
        String(PASSWORD_SCRYPT_R),
        String(PASSWORD_SCRYPT_P),
        String(PASSWORD_KEY_LENGTH),
        base64UrlEncode(salt),
        base64UrlEncode(derived),
    ].join('$');
};

const verifyHashedPassword = (plainPassword: string, storedHash: string): boolean => {
    const parts = storedHash.split('$');
    if (parts.length !== 8) {
        return false;
    }

    const [prefix, version, nRaw, rRaw, pRaw, keyLengthRaw, saltRaw, hashRaw] = parts;
    if (prefix !== PASSWORD_HASH_PREFIX || version !== PASSWORD_HASH_VERSION) {
        return false;
    }

    const n = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    const keyLength = Number(keyLengthRaw);
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !Number.isFinite(keyLength)) {
        return false;
    }

    let salt: Buffer;
    let expectedHash: Buffer;
    try {
        salt = base64UrlDecode(saltRaw);
        expectedHash = base64UrlDecode(hashRaw);
    } catch {
        return false;
    }

    const computed = scryptSync(plainPassword, salt, keyLength, {
        N: n,
        r,
        p,
        maxmem: PASSWORD_MAX_MEM,
    });

    return computed.length === expectedHash.length && timingSafeEqual(computed, expectedHash);
};

const verifyPassword = (
    plainPassword: string,
    storedPassword: string,
): { valid: boolean; shouldUpgrade: boolean } => {
    if (!storedPassword) {
        return { valid: false, shouldUpgrade: false };
    }

    if (storedPassword.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
        return {
            valid: verifyHashedPassword(plainPassword, storedPassword),
            shouldUpgrade: false,
        };
    }

    const valid = plainPassword === storedPassword;
    return {
        valid,
        shouldUpgrade: valid,
    };
};

const readBody = (req: ApiRequest): Record<string, unknown> => {
    if (typeof req.body === 'string') {
        try {
            const parsed = JSON.parse(req.body) as Record<string, unknown>;
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    if (req.body && typeof req.body === 'object') {
        return req.body as Record<string, unknown>;
    }

    return {};
};

const readBearerToken = (req: ApiRequest): string | null => {
    const raw = req.headers?.authorization || req.headers?.Authorization;
    const header = Array.isArray(raw) ? raw[0] : raw;
    if (!header || typeof header !== 'string') {
        return null;
    }
    const prefix = 'Bearer ';
    if (!header.startsWith(prefix)) {
        return null;
    }
    const token = header.slice(prefix.length).trim();
    return token || null;
};

const toPublicAccount = (row: PortalAccountRow) => {
    const username = normalizeUsername(row.username);
    const displayName = String(row.display_name || username.toUpperCase());
    return {
        username,
        displayName,
        role: normalizeRole(row.role),
        photoUrl: String(row.photo_url || defaultPhotoUrl(displayName, username)),
        active: Boolean(row.active ?? true),
    };
};

const fetchAccountByUsername = async (
    supabase: SupabaseClient,
    username: string,
): Promise<PortalAccountRow | null> => {
    const { data, error } = await supabase
        .from(ACCOUNTS_TABLE)
        .select('username, display_name, role, photo_url, password, active')
        .eq('username', normalizeUsername(username))
        .limit(1);

    if (error) {
        throw new Error(error.message);
    }

    const rows = (data as PortalAccountRow[] | null) || [];
    return rows[0] || null;
};

const insertAccount = async (
    supabase: SupabaseClient,
    payload: {
        username: string;
        displayName: string;
        role: PortalRole;
        passwordHash: string;
        active: boolean;
    },
): Promise<void> => {
    const { error } = await supabase
        .from(ACCOUNTS_TABLE)
        .insert([{
            username: normalizeUsername(payload.username),
            display_name: payload.displayName,
            role: payload.role,
            photo_url: defaultPhotoUrl(payload.displayName, payload.username),
            password: payload.passwordHash,
            active: payload.active,
        }]);

    if (error) {
        throw new Error(error.message);
    }
};

const updateAccount = async (
    supabase: SupabaseClient,
    username: string,
    updates: Record<string, string | boolean>,
): Promise<number> => {
    const { error, count } = await supabase
        .from(ACCOUNTS_TABLE)
        .update(updates, { count: 'exact' })
        .eq('username', normalizeUsername(username));

    if (error) {
        throw new Error(error.message);
    }

    return typeof count === 'number' ? count : 0;
};

const deleteAccount = async (supabase: SupabaseClient, username: string): Promise<number> => {
    const { error, count } = await supabase
        .from(ACCOUNTS_TABLE)
        .delete({ count: 'exact' })
        .eq('username', normalizeUsername(username));

    if (error) {
        throw new Error(error.message);
    }

    return typeof count === 'number' ? count : 0;
};

const requireSession = (
    req: ApiRequest,
    secret: string,
): { ok: true; payload: PortalSessionPayload } | { ok: false; status: number; code: string; message: string } => {
    const token = readBearerToken(req);
    if (!token) {
        return {
            ok: false,
            status: 401,
            code: 'unauthorized',
            message: 'โปรดเข้าสู่ระบบก่อนทำรายการ',
        };
    }

    const verification = verifySessionToken(token, secret);
    if (verification.valid === false) {
        return {
            ok: false,
            status: 401,
            code: verification.code,
            message: verification.message,
        };
    }

    return { ok: true, payload: verification.payload };
};

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, code: 'method_not_allowed', message: 'Method not allowed' });
        return;
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServerKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const tokenSecret = process.env.PORTAL_AUTH_TOKEN_SECRET || process.env.CRON_SECRET;

    if (!supabaseUrl || !supabaseServerKey || !tokenSecret) {
        res.status(500).json({
            success: false,
            code: 'missing_env',
            message: 'Missing required env vars: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY), PORTAL_AUTH_TOKEN_SECRET or CRON_SECRET',
        });
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseServerKey, {
        auth: { persistSession: false },
    });

    const body = readBody(req);
    const action = String(body.action || '').trim();
    if (!action) {
        res.status(400).json({ success: false, code: 'invalid_request', message: 'Missing action' });
        return;
    }

    try {
        if (action === 'login') {
            const username = normalizeUsername(body.username);
            const password = String(body.password || '');
            if (!username || !password) {
                res.status(400).json({ success: false, code: 'invalid_credentials', message: 'กรุณาระบุ Username และ Password' });
                return;
            }

            let account = await fetchAccountByUsername(supabase, username);
            if (!account && username === DEFAULT_MASTER_USERNAME && password === DEFAULT_MASTER_PASSWORD) {
                try {
                    await insertAccount(supabase, {
                        username: DEFAULT_MASTER_USERNAME,
                        displayName: 'Master Admin',
                        role: 'Master',
                        passwordHash: hashPassword(DEFAULT_MASTER_PASSWORD),
                        active: true,
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error || '');
                    if (!isDuplicateError(message)) {
                        throw error;
                    }
                }
                account = await fetchAccountByUsername(supabase, username);
            }

            if (!account) {
                res.status(401).json({ success: false, code: 'not_found', message: 'ไม่พบบัญชีผู้ดูแลระบบ' });
                return;
            }

            const active = Boolean(account.active ?? true);
            if (!active) {
                res.status(403).json({ success: false, code: 'inactive', message: 'บัญชีถูกระงับการใช้งาน' });
                return;
            }

            const verification = verifyPassword(password, String(account.password || ''));
            if (verification.valid === false) {
                res.status(401).json({ success: false, code: 'invalid_password', message: 'รหัสผ่านไม่ถูกต้อง' });
                return;
            }

            if (verification.shouldUpgrade) {
                await updateAccount(supabase, account.username, {
                    password: hashPassword(password),
                });
                account = await fetchAccountByUsername(supabase, username);
            }

            const publicAccount = toPublicAccount(account || {
                username,
                display_name: username.toUpperCase(),
                role: 'Admin',
                photo_url: defaultPhotoUrl(username.toUpperCase(), username),
                password: null,
                active: true,
            });
            const nowSeconds = Math.floor(Date.now() / 1000);
            const sessionToken = issueSessionToken({
                username: publicAccount.username,
                role: publicAccount.role,
                iat: nowSeconds,
                exp: nowSeconds + SESSION_TTL_SECONDS,
            }, tokenSecret);

            res.status(200).json({
                success: true,
                account: publicAccount,
                sessionToken,
                message: 'เข้าสู่ระบบสำเร็จ',
            });
            return;
        }

        if (action === 'add_admin') {
            const session = requireSession(req, tokenSecret);
            if (session.ok === false) {
                res.status(session.status).json({ success: false, code: session.code, message: session.message });
                return;
            }
            if (session.payload.role !== 'Master') {
                res.status(403).json({ success: false, code: 'forbidden', message: 'เฉพาะ Master เท่านั้นที่เพิ่มแอดมินได้' });
                return;
            }

            const username = normalizeUsername(body.username);
            const displayName = String(body.displayName || '').trim();
            const password = String(body.password || '');
            if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
                res.status(400).json({ success: false, code: 'invalid_username', message: 'Username ต้องเป็น a-z, 0-9, ., _, - และยาว 3-32 ตัวอักษร' });
                return;
            }
            if (username === DEFAULT_MASTER_USERNAME) {
                res.status(400).json({ success: false, code: 'invalid_username', message: 'ไม่สามารถสร้างบัญชีชื่อ master ซ้ำได้' });
                return;
            }
            if (password.length < 6) {
                res.status(400).json({ success: false, code: 'invalid_password', message: 'รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร' });
                return;
            }

            const existing = await fetchAccountByUsername(supabase, username);
            if (existing) {
                res.status(409).json({ success: false, code: 'duplicate', message: 'Username นี้ถูกใช้งานแล้ว' });
                return;
            }

            await insertAccount(supabase, {
                username,
                displayName: displayName || username.toUpperCase(),
                role: 'Admin',
                passwordHash: hashPassword(password),
                active: true,
            });

            res.status(200).json({ success: true, message: 'เพิ่มแอดมินเรียบร้อยแล้ว' });
            return;
        }

        if (action === 'update_admin') {
            const session = requireSession(req, tokenSecret);
            if (session.ok === false) {
                res.status(session.status).json({ success: false, code: session.code, message: session.message });
                return;
            }
            if (session.payload.role !== 'Master') {
                res.status(403).json({ success: false, code: 'forbidden', message: 'เฉพาะ Master เท่านั้นที่แก้ไขแอดมินได้' });
                return;
            }

            const username = normalizeUsername(body.username);
            const displayName = String(body.displayName || '').trim();
            const password = String(body.password || '').trim();
            if (!username) {
                res.status(400).json({ success: false, code: 'invalid_username', message: 'กรุณาระบุ Username' });
                return;
            }
            if (username === DEFAULT_MASTER_USERNAME) {
                res.status(400).json({ success: false, code: 'forbidden', message: 'ไม่สามารถแก้ไขบัญชี Master ที่นี่ได้' });
                return;
            }
            if (!displayName) {
                res.status(400).json({ success: false, code: 'invalid_display_name', message: 'กรุณากรอกชื่อที่แสดง' });
                return;
            }
            if (password && password.length < 6) {
                res.status(400).json({ success: false, code: 'invalid_password', message: 'รหัสผ่านต้องอย่างน้อย 6 ตัวอักษร' });
                return;
            }

            const updates: Record<string, string> = {
                display_name: displayName,
                photo_url: defaultPhotoUrl(displayName, username),
            };
            if (password) {
                updates.password = hashPassword(password);
            }

            const updatedRows = await updateAccount(supabase, username, updates);
            if (updatedRows < 1) {
                res.status(404).json({ success: false, code: 'not_found', message: 'ไม่พบบัญชีแอดมินที่ต้องการแก้ไข' });
                return;
            }

            res.status(200).json({ success: true, message: 'แก้ไขข้อมูลแอดมินเรียบร้อยแล้ว' });
            return;
        }

        if (action === 'delete_admin') {
            const session = requireSession(req, tokenSecret);
            if (session.ok === false) {
                res.status(session.status).json({ success: false, code: session.code, message: session.message });
                return;
            }
            if (session.payload.role !== 'Master') {
                res.status(403).json({ success: false, code: 'forbidden', message: 'เฉพาะ Master เท่านั้นที่ลบบัญชีแอดมินได้' });
                return;
            }

            const username = normalizeUsername(body.username);
            if (!username) {
                res.status(400).json({ success: false, code: 'invalid_username', message: 'กรุณาระบุ Username' });
                return;
            }
            if (username === DEFAULT_MASTER_USERNAME) {
                res.status(400).json({ success: false, code: 'forbidden', message: 'ไม่สามารถลบบัญชี Master ได้' });
                return;
            }
            if (username === normalizeUsername(session.payload.username)) {
                res.status(400).json({ success: false, code: 'forbidden', message: 'ไม่สามารถลบบัญชีที่กำลังใช้งานอยู่ได้' });
                return;
            }

            const deletedRows = await deleteAccount(supabase, username);
            if (deletedRows < 1) {
                res.status(404).json({ success: false, code: 'not_found', message: 'ไม่พบบัญชีแอดมินที่ต้องการลบ' });
                return;
            }

            res.status(200).json({ success: true, message: 'ลบบัญชีแอดมินเรียบร้อยแล้ว' });
            return;
        }

        if (action === 'change_own_password') {
            const session = requireSession(req, tokenSecret);
            if (session.ok === false) {
                res.status(session.status).json({ success: false, code: session.code, message: session.message });
                return;
            }

            const currentPassword = String(body.currentPassword || '');
            const newPassword = String(body.newPassword || '');
            if (newPassword.length < 6) {
                res.status(400).json({ success: false, code: 'invalid_password', message: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร' });
                return;
            }
            if (newPassword === currentPassword) {
                res.status(400).json({ success: false, code: 'invalid_password', message: 'รหัสผ่านใหม่ต้องไม่ซ้ำรหัสผ่านเดิม' });
                return;
            }

            const account = await fetchAccountByUsername(supabase, session.payload.username);
            if (!account) {
                res.status(404).json({ success: false, code: 'not_found', message: 'ไม่พบบัญชีผู้ใช้บนเซิร์ฟเวอร์' });
                return;
            }

            const verification = verifyPassword(currentPassword, String(account.password || ''));
            if (verification.valid === false) {
                res.status(401).json({ success: false, code: 'invalid_password', message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
                return;
            }

            const updatedRows = await updateAccount(supabase, session.payload.username, {
                password: hashPassword(newPassword),
            });
            if (updatedRows < 1) {
                res.status(404).json({ success: false, code: 'not_found', message: 'ไม่พบบัญชีที่ต้องการอัปเดตรหัสผ่าน' });
                return;
            }

            res.status(200).json({ success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
            return;
        }

        res.status(400).json({ success: false, code: 'invalid_action', message: 'Unsupported action' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        res.status(500).json({ success: false, code: 'server_error', message });
    }
}
