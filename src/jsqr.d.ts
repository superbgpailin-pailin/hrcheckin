declare module 'jsqr' {
    export interface QRCodeLocation {
        [key: string]: unknown;
    }

    export interface QRCodeChunk {
        [key: string]: unknown;
    }

    export interface QRCode {
        binaryData: number[];
        data: string;
        chunks: QRCodeChunk[];
        location: QRCodeLocation;
    }

    function jsQR(data: Uint8ClampedArray, width: number, height: number): QRCode | null;
    export default jsQR;
}
