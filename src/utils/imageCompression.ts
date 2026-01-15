
import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    initialQuality?: number;
}

/**
 * Compresses an image file for efficient storage.
 * Default settings target ~50KB-100KB for typical phone photos.
 */
export const compressImage = async (file: File, options?: CompressionOptions): Promise<File> => {
    const defaultOptions = {
        maxSizeMB: 0.1, // Target 100KB
        maxWidthOrHeight: 800, // Sufficient for verifying identity/location
        useWebWorker: true,
        initialQuality: 0.7,
        fileType: 'image/webp', // Use WebP for better compression if possible
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
        const compressedFile = await imageCompression(file, finalOptions);
        console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
        return compressedFile;
    } catch (error) {
        console.error('Image compression failed:', error);
        throw error; // Re-throw to handle in UI
    }
};
