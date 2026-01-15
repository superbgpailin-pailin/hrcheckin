import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { useSite } from '../context/SiteContext';
import { type Site } from '../data/mockSites';
import { useAuth } from '../context/AuthContext';
import { attendanceService } from '../services/attendanceService';
import './TimeAttendance.css';

// Helper to convert base64 to File
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
};

// Haversine Formula for distance calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
};

export const TimeAttendance: React.FC = () => {
    const { language } = useLanguage();
    const t = getTranslation(language);
    const { sites } = useSite(); // Use dynamic sites
    const { currentUser } = useAuth();
    const [time, setTime] = useState(new Date());

    // Location State
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedSite, setSelectedSite] = useState<Site>(sites[0]); // Init from context
    const [distance, setDistance] = useState<number | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Camera State
    const webcamRef = useRef<Webcam>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [checkInMode, setCheckInMode] = useState<'in' | 'out'>('in');

    // Loading State
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Update selected site if sites change (e.g. deletion)
    useEffect(() => {
        if (!sites.find(s => s.id === selectedSite.id)) {
            if (sites.length > 0) setSelectedSite(sites[0]);
        }
    }, [sites, selectedSite.id]);

    // Geolocation Watcher
    useEffect(() => {
        if (!navigator.geolocation) {
            setErrorMsg('Geolocation is not supported by your browser');
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                setCurrentLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
                setErrorMsg(null);
            },
            (error) => {
                setErrorMsg(`Location Error: ${error.message}`);
            },
            { enableHighAccuracy: true }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Update Distance
    useEffect(() => {
        if (currentLocation && selectedSite) {
            const dist = calculateDistance(
                currentLocation.lat,
                currentLocation.lng,
                selectedSite.lat,
                selectedSite.lng
            );
            setDistance(dist);
        }
    }, [currentLocation, selectedSite]);

    const handleCapture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) setCapturedImage(imageSrc);
    }, [webcamRef]);

    const handleConfirm = async () => {
        if (!capturedImage || !currentUser || !currentLocation) return;

        setIsSubmitting(true);
        try {
            // 1. Convert Base64 to File
            const file = dataURLtoFile(capturedImage, `photo_${Date.now()}.jpg`);

            // 2. Upload to Supabase Storage
            // Using a mock User ID for storage structure if Supabase Auth isn't fully linked to mock users yet. 
            // Ideally we use currentUser.id (which is 'EMP001' etc. currently).
            // But Supabase storage usually expects UUIDs or safe strings. 'EMP001' is safe.
            const photoUrl = await attendanceService.uploadPhoto(file, currentUser.id, checkInMode);

            // 3. Insert Record
            // Assuming "Morning Shift" as default for now implies we might need to get this from context or selection
            // For now, we'll hardcode or pass a default since this component doesn't know about the shift selected in CheckInFlow
            // However, CheckInFlow selects the shift, but TimeAttendance is a child.
            // Ideally TimeAttendance should accept props. 
            // For now, we will just pass "Default" or "Morning" as a placeholder to unblock.
            await attendanceService.recordAttendance(
                currentUser.id, // Supabase User ID (using Employee ID for now as they are the same in mock)
                currentUser.id, // Employee ID (e.g., EMP001)
                checkInMode === 'in' ? 'check_in' : 'check_out',
                selectedSite,
                currentLocation,
                photoUrl,
                'Morning' // TODO: Pass this as prop from CheckInFlow
            );

            alert(`${checkInMode === 'in' ? 'Check In' : 'Check Out'} Successful!\nSite: ${selectedSite.name}\nDistance: ${distance?.toFixed(0)}m\nSaved to Supabase.`);
            setShowCamera(false);
            setCapturedImage(null);
        } catch (error: any) {
            console.error(error);
            alert('Error recording attendance: ' + (error.message || 'Unknown error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const startCheckIn = (mode: 'in' | 'out') => {
        setCheckInMode(mode);
        setShowCamera(true);
    };

    const isOutOfRange = distance !== null && distance > selectedSite.radius;

    return (
        <div className="attendance-container">
            <h1 className="page-title">{t.menu.timeAttendance}</h1>

            <div className="clock-card clean-card">
                {/* Site Selector */}
                <div style={{ marginBottom: '1.5rem', width: '100%', maxWidth: '400px' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {t.menu.selectSite}
                    </label>
                    <select
                        value={selectedSite.id}
                        onChange={(e) => setSelectedSite(sites.find(s => s.id === e.target.value) || sites[0])}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            fontSize: '1rem'
                        }}
                    >
                        {sites.map(site => (
                            <option key={site.id} value={site.id}>{site.name}</option>
                        ))}
                    </select>
                </div>

                {/* Time Display */}
                <div className="current-time">
                    {time.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div className="current-date">
                    {time.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>

                {/* Map / GPS Status */}
                <div className="map-placeholder" style={{
                    background: distance !== null && !isOutOfRange ? '#ecfdf5' : '#fef2f2',
                    border: `2px solid ${distance !== null && !isOutOfRange ? '#10b981' : '#ef4444'}`,
                    color: distance !== null && !isOutOfRange ? '#047857' : '#b91c1c'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ fontSize: '1.5rem' }}>{distance !== null && !isOutOfRange ? '📍' : '🚫'}</div>
                        <div style={{ fontWeight: 600 }}>
                            {distance !== null ? `${t.menu.distance}: ${distance.toFixed(0)}m` : 'Finding Location...'}
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>
                            {distance !== null && !isOutOfRange ? t.menu.inRange : t.menu.outOfRange} ({selectedSite.name})
                        </div>
                        {errorMsg && <div style={{ fontSize: '0.8rem', color: 'red' }}>{errorMsg}</div>}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="check-btn-container">
                    <button
                        className="check-btn btn-in"
                        onClick={() => startCheckIn('in')}
                        disabled={isOutOfRange || currentLocation === null}
                        style={{ opacity: isOutOfRange ? 0.5 : 1, cursor: isOutOfRange ? 'not-allowed' : 'pointer' }}
                    >
                        <span className="btn-icon">Login</span>
                        Check In
                    </button>
                    <button
                        className="check-btn btn-out"
                        onClick={() => startCheckIn('out')}
                        disabled={isOutOfRange || currentLocation === null}
                        style={{ opacity: isOutOfRange ? 0.5 : 1, cursor: isOutOfRange ? 'not-allowed' : 'pointer' }}
                    >
                        <span className="btn-icon">Logout</span>
                        Check Out
                    </button>
                </div>
            </div>

            {/* Selfie Modal */}
            {showCamera && (
                <div className="sidebar-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="clean-card" style={{ padding: '1.5rem', width: '90%', maxWidth: '500px', background: 'white' }}>
                        <h3 style={{ marginTop: 0 }}>{t.menu.takePhoto} ({checkInMode === 'in' ? 'Check In' : 'Check Out'})</h3>

                        <div style={{ marginBottom: '1rem', background: '#000', borderRadius: '8px', overflow: 'hidden', minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {capturedImage ? (
                                <img src={capturedImage} alt="Selfie" style={{ width: '100%' }} />
                            ) : (
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    width="100%"
                                    videoConstraints={{ facingMode: 'user' }}
                                />
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => setShowCamera(false)}
                                disabled={isSubmitting}
                                style={{ padding: '0.75rem 1.5rem', border: '1px solid #ddd', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                            >
                                Cancel
                            </button>

                            {!capturedImage ? (
                                <button
                                    onClick={handleCapture}
                                    style={{ padding: '0.75rem 1.5rem', background: 'var(--primary-color)', color: 'white', borderRadius: '8px' }}
                                >
                                    Capture
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setCapturedImage(null)}
                                        disabled={isSubmitting}
                                        style={{ padding: '0.75rem 1.5rem', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                                    >
                                        {t.menu.retake}
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={isSubmitting}
                                        style={{ padding: '0.75rem 1.5rem', background: 'var(--success-color)', color: 'white', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                                    >
                                        {isSubmitting ? 'Saving...' : (checkInMode === 'in' ? t.menu.confirmCheckIn : t.menu.confirmCheckOut)}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

