import { supabase } from '../lib/supabaseClient';
import { compressImage } from '../utils/imageCompression';

const bucket = 'employee-documents';
const UPLOAD_FAILED_MESSAGE = 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่';
const INVALID_IMAGE_MESSAGE = 'รองรับเฉพาะไฟล์รูปภาพเท่านั้น';
const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_BYTES = 1 * 1024 * 1024;

const extensionFromMime = (mime: string): string => {
    const [, ext = 'webp'] = mime.split('/');
    const normalizedExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalizedExt || 'webp';
};

const sanitizeStorageSegment = (value: string, fallback = 'UNKNOWN'): string => {
    const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    return normalized || fallback;
};

const createUploadNonce = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(4);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).slice(2, 10);
};

const assertImageFile = (file: File, maxBytes: number, tooLargeMessage: string): void => {
    if (!file.type.startsWith('image/')) {
        throw new Error(INVALID_IMAGE_MESSAGE);
    }
    if (file.size <= 0) {
        throw new Error(INVALID_IMAGE_MESSAGE);
    }
    if (file.size > maxBytes) {
        throw new Error(tooLargeMessage);
    }
};

const compressForUpload = async (file: File): Promise<File> => {
    assertImageFile(file, MAX_SOURCE_IMAGE_BYTES, 'ขนาดไฟล์ใหญ่เกินไป (สูงสุด 15MB)');
    const compressed = await compressImage(file);
    assertImageFile(compressed, MAX_COMPRESSED_IMAGE_BYTES, 'รูปภาพหลังย่อยังใหญ่เกินกำหนด (สูงสุด 1MB)');
    return compressed;
};

const uploadToStorage = async (path: string, file: File): Promise<string> => {
    const { error: uploadError } = await supabase
        .storage
        .from(bucket)
        .upload(path, file, {
            contentType: file.type || 'image/webp',
            cacheControl: '3600',
            upsert: false,
        });

    if (uploadError) {
        console.error('[uploadToStorage] Supabase storage error:', uploadError.message, { path, bucket });
        throw new Error(`${UPLOAD_FAILED_MESSAGE} (${uploadError.message})`);
    }

    const publicUrlResult = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = publicUrlResult.data.publicUrl;
    if (!publicUrl) {
        throw new Error(UPLOAD_FAILED_MESSAGE);
    }

    return publicUrl;
};

export const appFileUploadService = {
    async uploadEmployeeImage(file: File, category: 'selfie' | 'id-card' | 'passport', employeeId: string): Promise<string> {
        const compressed = await compressForUpload(file);
        const ext = extensionFromMime(compressed.type || 'image/webp');
        const safeId = sanitizeStorageSegment(employeeId);
        const path = `${safeId}/${category}/${Date.now()}-${createUploadNonce()}.${ext}`;

        return uploadToStorage(path, compressed);
    },

    async uploadCheckInSelfie(file: File, employeeId: string): Promise<string> {
        const compressed = await compressForUpload(file);
        const ext = extensionFromMime(compressed.type || 'image/webp');
        const safeId = sanitizeStorageSegment(employeeId);
        const path = `checkin/${safeId}/selfie/${Date.now()}-${createUploadNonce()}.${ext}`;

        return uploadToStorage(path, compressed);
    },
};
