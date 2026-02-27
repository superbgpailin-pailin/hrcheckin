import React from 'react';
import { useAppLanguage } from '../context/AppLanguageContext';

interface AppLandingProps {
    checkInHref: string;
    selfProfileHref: string;
    kioskHref: string;
    adminPortalHref: string;
    onOpenCheckIn: () => void;
    onOpenSelfProfile: () => void;
    onOpenKiosk: () => void;
    onOpenAdminLogin: () => void;
}

const TEXT = {
    th: {
        title: 'HR CheckIn',
        checkIn: 'Check In',
        form: 'Employee Form',
        kiosk: 'QR Kiosk',
        admin: 'Admin Portal',
        langBtn: 'KH',
    },
    km: {
        title: 'HR CheckIn',
        checkIn: 'ចុះវត្តមាន',
        form: 'ទម្រង់បុគ្គលិក',
        kiosk: 'QR Kiosk',
        admin: 'ផ្ទាំងអ្នកគ្រប់គ្រង',
        langBtn: 'TH',
    },
} as const;

export const AppLanding: React.FC<AppLandingProps> = ({
    checkInHref,
    selfProfileHref,
    kioskHref,
    adminPortalHref,
    onOpenCheckIn,
    onOpenSelfProfile,
    onOpenKiosk,
    onOpenAdminLogin,
}) => {
    const { language, toggleLanguage } = useAppLanguage();
    const t = TEXT[language];

    return (
        <div className="landing-screen">
            <div className="landing-orb orb-a" />
            <div className="landing-orb orb-b" />
            <div className="landing-orb orb-c" />

            <section className="landing-panel reveal-up">
                <div className="landing-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>{t.title}</h1>
                    <button type="button" className="btn-muted" onClick={toggleLanguage}>{t.langBtn}</button>
                </div>

                <nav className="landing-menu" aria-label="Main menu">
                    <a
                        className="landing-menu-btn checkin"
                        href={checkInHref}
                        onClick={(event) => {
                            event.preventDefault();
                            onOpenCheckIn();
                        }}
                    >
                        <span className="landing-menu-icon" aria-hidden="true">📱</span>
                        <span className="landing-menu-text">
                            <span className="landing-menu-title">{t.checkIn}</span>
                        </span>
                    </a>

                    <a
                        className="landing-menu-btn profile"
                        href={selfProfileHref}
                        onClick={(event) => {
                            event.preventDefault();
                            onOpenSelfProfile();
                        }}
                    >
                        <span className="landing-menu-icon" aria-hidden="true">📝</span>
                        <span className="landing-menu-text">
                            <span className="landing-menu-title">{t.form}</span>
                        </span>
                    </a>

                    <a
                        className="landing-menu-btn kiosk"
                        href={kioskHref}
                        onClick={(event) => {
                            event.preventDefault();
                            onOpenKiosk();
                        }}
                    >
                        <span className="landing-menu-icon" aria-hidden="true">🧿</span>
                        <span className="landing-menu-text">
                            <span className="landing-menu-title">{t.kiosk}</span>
                        </span>
                    </a>

                    <a
                        className="landing-menu-btn admin"
                        href={adminPortalHref}
                        onClick={(event) => {
                            event.preventDefault();
                            onOpenAdminLogin();
                        }}
                    >
                        <span className="landing-menu-icon" aria-hidden="true">🛠️</span>
                        <span className="landing-menu-text">
                            <span className="landing-menu-title">{t.admin}</span>
                        </span>
                    </a>
                </nav>
            </section>
        </div>
    );
};
