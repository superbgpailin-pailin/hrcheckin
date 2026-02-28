import { supabase } from '../lib/supabaseClient';
import { compressImage } from '../utils/imageCompression';

const bucket = 'employee-documents';
const UPLOAD_FAILED_MESSAGE = 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่';

const extensionFromMime = (mime: string): string => {
    const [, ext = 'webp'] = mime.split('/');
    return ext.toLowerCase();
};

const uploadToStorage = async (path: string, file: File): Promise<string> => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const { error: uploadError } = await supabase
            .storage
            .from(bucket)
            .upload(path, file, { upsert: false, contentType: file.type || 'image/webp' });

        if (!uploadError) {
            const publicUrlResult = supabase.storage.from(bucket).getPublicUrl(path);
            const publicUrl = publicUrlResult.data.publicUrl;
            if (publicUrl) {
                return publicUrl;
            }
        }

        if (attempt === 1) {
            throw new Error(UPLOAD_FAILED_MESSAGE);
        }
    }

    throw new Error(UPLOAD_FAILED_MESSAGE);
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
