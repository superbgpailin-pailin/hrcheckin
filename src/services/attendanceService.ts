
import { supabase } from '../lib/supabaseClient';
import { compressImage } from '../utils/imageCompression';

const TABLE_NAME = 'attendance';
const BUCKET_NAME = 'attendance-photos';

export interface AttendanceRecord {
    id: string;
    user_id: string;
    employee_id: string;
    timestamp: string;
    type: 'check_in' | 'check_out';
    site_id: string;
    site_name: string;
    lat: number;
    lng: number;
    photo_url: string;
    status: 'On Time' | 'Late';
    shift_name?: string;
}

export const attendanceService = {
    /**
     * Uploads a photo to Supabase Storage.
     */
    async uploadPhoto(file: File, userId: string, type: 'in' | 'out'): Promise<string> {
        try {
            // 1. Compress the image
            const compressedFile = await compressImage(file);

            // 2. Generate a unique path: userId/YYYY-MM-DD/timestamp_type.webp
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timestamp = now.getTime();
            const path = `${userId}/${dateStr}/${timestamp}_${type}.webp`;

            // 3. Upload
            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(path, compressedFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // 4. Get Public URL
            const { data: publicUrlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(path);

            return publicUrlData.publicUrl;
        } catch (error) {
            console.error('Error uploading photo:', error);
            throw error;
        }
    },

    /**
     * Records attendance in the database.
     */
    async recordAttendance(
        userId: string,
        employeeId: string,
        type: 'check_in' | 'check_out',
        site: { id: string; name: string },
        location: { lat: number; lng: number },
        photoUrl: string,
        shift: string
    ): Promise<any> {
        // Current time
        const now = new Date();
        // Simple logic for status (can be enhanced)
        // e.g., if check_in and time > 8:00 -> Late
        // This logic should ideally be consistent with the Shift rules.
        let status = 'On Time';
        if (type === 'check_in') {
            const hour = now.getHours();
            // Example: Morning shift starts at 8:00.
            // If shift includes 'Morning' and hour >= 9 (allowing 8:xx), etc.
            // For now, let's keep it simple or pass it in.
            if (shift.includes('Morning') && (hour > 8 || (hour === 8 && now.getMinutes() > 15))) {
                status = 'Late';
            }
        }

        const { data, error } = await supabase
            .from(TABLE_NAME)
            .insert([
                {
                    user_id: userId,
                    employee_id: employeeId,
                    timestamp: now.toISOString(),
                    type,
                    site_id: site.id,
                    site_name: site.name,
                    lat: location.lat,
                    lng: location.lng,
                    photo_url: photoUrl,
                    status,
                    shift_name: shift
                }
            ])
            .select();

        if (error) throw error;
        return data[0];
    },

    /**
     * Fetches attendance history for a user.
     */
    async getHistory(userId: string): Promise<AttendanceRecord[]> {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('user_id', userId)
            .order('timestamp', { ascending: false });

        if (error) throw error;
        return data as AttendanceRecord[];
    }
};
