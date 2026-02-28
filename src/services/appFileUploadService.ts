import { supabase } from '../lib/supabaseClient';
import { compressImage } from '../utils/imageCompression';

const bucket = 'employee-documents';
const UPLOAD_FAILED_MESSAGE = 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่';

const extensionFromMime = (mime: string): string => {
    const [, ext = 'webp'] = mime.split('/');
    return ext.toLowerCase();
};

const uploadToStorage = async (path: string, file: File): Promise<string> => {
    const { error: uploadError } = await supabase
        .storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type || 'image/webp' });

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
        const compressed = await compressImage(file);
        const ext = extensionFromMime(compressed.type || 'image/webp');
        const safeId = employeeId.trim().toUpperCase() || 'UNKNOWN';
        const path = `${safeId}/${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        return uploadToStorage(path, compressed);
    },

    async uploadCheckInSelfie(file: File, employeeId: string): Promise<string> {
        const compressed = await compressImage(file);
        const ext = extensionFromMime(compressed.type || 'image/webp');
        const safeId = employeeId.trim().toUpperCase() || 'UNKNOWN';
        const path = `checkin/${safeId}/selfie/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        return uploadToStorage(path, compressed);
    },
};
