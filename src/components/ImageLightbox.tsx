import React, { useEffect } from 'react';

interface ImageLightboxProps {
    imageUrl: string;
    alt: string;
    onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({ imageUrl, alt, onClose }) => {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [onClose]);

    return (
        <div
            className="image-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            onClick={onClose}
        >
            <button
                type="button"
                className="image-lightbox-close"
                onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                }}
                aria-label="Close image preview"
            >
                x
            </button>
            <img
                src={imageUrl}
                alt={alt}
                className="image-lightbox-img"
                onClick={(event) => event.stopPropagation()}
            />
        </div>
    );
};
