import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAppSettings } from '../context/AppSettingsContext';
import { createQrToken } from '../utils/qrToken';

interface AppKioskProps {
    onBack?: () => void;
}

export const AppKiosk: React.FC<AppKioskProps> = ({ onBack }) => {
    const { config } = useAppSettings();
    const [kioskId, setKioskId] = useState('front-desk');
    const [token, setToken] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(config.qrRefreshSeconds);

    useEffect(() => {
        const regenerate = () => {
            const next = createQrToken(kioskId, config.qrSecret, config.qrTokenLifetimeSeconds);
            setToken(next);
            setSecondsLeft(config.qrRefreshSeconds);
        };

        regenerate();
        const refreshTimer = window.setInterval(regenerate, config.qrRefreshSeconds * 1000);
        const secondTimer = window.setInterval(() => {
            setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => {
            clearInterval(refreshTimer);
            clearInterval(secondTimer);
        };
    }, [config.qrRefreshSeconds, config.qrSecret, config.qrTokenLifetimeSeconds, kioskId]);

    const progress = useMemo(() => {
        if (config.qrRefreshSeconds <= 0) {
            return 0;
        }
        return (secondsLeft / config.qrRefreshSeconds) * 100;
    }, [config.qrRefreshSeconds, secondsLeft]);

    return (
        <div className="kiosk-screen reveal-up">
            <div className="kiosk-header">
                <h2>QR Kiosk Live</h2>
                <p>เปิดหน้าจอนี้ค้างไว้สำหรับให้พนักงานสแกนเช็คอิน</p>
                {onBack ? (
                    <div className="inline-actions" style={{ marginTop: '0.5rem' }}>
                        <button type="button" className="btn-muted" onClick={onBack}>กลับหน้าหลัก</button>
                    </div>
                ) : null}
            </div>

            <div className="kiosk-controls">
                <label htmlFor="kiosk-id">Kiosk ID</label>
                <input
                    id="kiosk-id"
                    value={kioskId}
                    onChange={(event) => setKioskId(event.target.value.trim().toLowerCase() || 'front-desk')}
                />
            </div>

            <div className="kiosk-qr-card">
                {token ? <QRCodeCanvas value={token} size={320} includeMargin level="H" /> : null}
            </div>

            <div className="kiosk-timer">
                <div className="timer-bar">
                    <div className="timer-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="panel-muted">QR จะเปลี่ยนใน {secondsLeft} วินาที</div>
            </div>
        </div>
    );
};
