import imageCompression from 'browser-image-compression';

export interface CompressionOptions {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    initialQuality?: number;
}

export const compressImage = async (file: File, options?: CompressionOptions): Promise<File> => {
    const defaultOptions = {
        maxSizeMB: 0.08,
        maxWidthOrHeight: 960,
        useWebWorker: true,
        initialQuality: 0.65,
        fileType: 'image/webp',
    };

    const finalOptions = { ...defaultOptions, ...options };
    return imageCompression(file, finalOptions);
};
