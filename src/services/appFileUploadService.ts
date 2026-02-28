import { supabase } from '../lib/supabaseClient';
import { compressImage } from '../utils/imageCompression';

const bucket = 'employee-documents';

const fileToDataUrl = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
        reader.readAsDataURL(file);
    });
};

const extensionFromMime = (mime: string): string => {
    const [, ext = 'webp'] = mime.split('/');
    return ext.toLowerCase();
};

export const appFileUploadService = {
    async uploadEmployeeImage(file: File, category: 'selfie' | 'id-card' | 'passport', employeeId: string): Promise<string> {
        const compressed = await compressImage(file);
        const ext = extensionFromMime(compressed.type || 'image/webp');
        const safeId = employeeId.trim().toUpperCase() || 'UNKNOWN';
        const path = `${safeId}/${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabase
            .storage
            .from(bucket)
            .upload(path, compressed, { upsert: false, contentType: compressed.type || 'image/webp' });

        if (!uploadError) {
            const publicUrlResult = supabase.storage.from(bucket).getPublicUrl(path);
            const publicUrl = publicUrlResult.data.publicUrl;
            if (publicUrl) {
                return publicUrl;
            }
        }

        return fileToDataUrl(compressed);
    },

    async uploadCheckInSelfie(file: File, employeeId: string): Promise<string> {
        const compressed = await compressImage(file);
        const ext = extensionFromMime(compressed.type || 'image/webp');
        const safeId = employeeId.trim().toUpperCase() || 'UNKNOWN';
        const path = `checkin/${safeId}/selfie/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabase
            .storage
            .from(bucket)
            .upload(path, compressed, { upsert: false, contentType: compressed.type || 'image/webp' });

        if (!uploadError) {
            const publicUrlResult = supabase.storage.from(bucket).getPublicUrl(path);
            const publicUrl = publicUrlResult.data.publicUrl;
            if (publicUrl) {
                return publicUrl;
            }
        }

        return fileToDataUrl(compressed);
    },
};
