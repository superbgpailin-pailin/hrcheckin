import { HmacSHA256 } from 'crypto-js';
import type { QrTokenPayload } from '../types/app';

const USED_NONCE_KEY = 'hrcheckin_used_qr_nonces';

const signatureBase = (payload: Omit<QrTokenPayload, 'signature'>): string => {
    return `${payload.kioskId}|${payload.nonce}|${payload.issuedAt}|${payload.expiresAt}`;
};

const safeParse = (raw: string): QrTokenPayload | null => {
    try {
        return JSON.parse(raw) as QrTokenPayload;
    } catch {
        return null;
    }
};

const randomNonce = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const createQrToken = (
    kioskId: string,
    secret: string,
    ttlSeconds: number,
    nowMillis = Date.now(),
): string => {
    const payloadWithoutSignature: Omit<QrTokenPayload, 'signature'> = {
        kioskId,
        nonce: randomNonce(),
        issuedAt: nowMillis,
        expiresAt: nowMillis + ttlSeconds * 1000,
    };

    const signature = HmacSHA256(signatureBase(payloadWithoutSignature), secret).toString();
    const payload: QrTokenPayload = {
        ...payloadWithoutSignature,
        signature,
    };

    return JSON.stringify(payload);
};

export const verifyQrToken = (
    raw: string,
    secret: string,
    nowMillis = Date.now(),
): { valid: boolean; payload?: QrTokenPayload; reason?: string } => {
    const payload = safeParse(raw);

    if (!payload) {
        return { valid: false, reason: 'รูปแบบ QR ไม่ถูกต้อง' };
    }

    const expected = HmacSHA256(
        signatureBase({
            kioskId: payload.kioskId,
            nonce: payload.nonce,
            issuedAt: payload.issuedAt,
            expiresAt: payload.expiresAt,
        }),
        secret,
    ).toString();

    if (expected !== payload.signature) {
        return { valid: false, reason: 'ลายเซ็น QR ไม่ถูกต้อง' };
    }

    if (payload.expiresAt < nowMillis) {
        return { valid: false, reason: 'QR หมดอายุแล้ว' };
    }

    return { valid: true, payload };
};

const readNonceCache = (): Record<string, number> => {
    try {
        const raw = localStorage.getItem(USED_NONCE_KEY);
        if (!raw) {
            return {};
        }
        return JSON.parse(raw) as Record<string, number>;
    } catch {
        return {};
    }
};

const writeNonceCache = (cache: Record<string, number>): void => {
    localStorage.setItem(USED_NONCE_KEY, JSON.stringify(cache));
};

const cleanupNonceCache = (nowMillis: number): Record<string, number> => {
    const cache = readNonceCache();
    const next: Record<string, number> = {};

    Object.entries(cache).forEach(([nonce, expiresAt]) => {
        if (expiresAt >= nowMillis) {
            next[nonce] = expiresAt;
        }
    });

    writeNonceCache(next);
    return next;
};

export const hasNonceBeenUsed = (nonce: string, nowMillis = Date.now()): boolean => {
    const cache = cleanupNonceCache(nowMillis);
    return Boolean(cache[nonce]);
};

export const markNonceAsUsed = (nonce: string, expiresAt: number): void => {
    const cache = cleanupNonceCache(Date.now());
    cache[nonce] = expiresAt;
    writeNonceCache(cache);
};
