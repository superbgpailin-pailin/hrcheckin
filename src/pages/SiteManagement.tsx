import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { useSite } from '../context/SiteContext';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { type Site } from '../data/mockSites';

export const SiteManagement: React.FC = () => {
    const { sites, addSite, updateSite, deleteSite } = useSite();
    const { language } = useLanguage();
    const t = getTranslation(language);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);
    const [formData, setFormData] = useState<Omit<Site, 'id'>>({ name: '', lat: 13.7563, lng: 100.5018, radius: 100 });
    const [showQR, setShowQR] = useState<string | null>(null);

    const handleEdit = (site: Site) => {
        setEditingSite(site);
        setFormData({ name: site.name, lat: site.lat, lng: site.lng, radius: site.radius });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this site?')) {
            deleteSite(id);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingSite) {
            updateSite({ ...formData, id: editingSite.id });
        } else {
            addSite(formData);
        }
        setIsModalOpen(false);
        setEditingSite(null);
        setFormData({ name: '', lat: 13.7563, lng: 100.5018, radius: 100 });
    };

    const getCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setFormData(prev => ({
                        ...prev,
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }));
                },
                (error) => alert('Error getting location: ' + error.message)
            );
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 className="page-title" style={{ marginBottom: 0 }}>{t.menu.siteManagement}</h1>
                <button
                    onClick={() => { setEditingSite(null); setFormData({ name: '', lat: 13.7563, lng: 100.5018, radius: 100 }); setIsModalOpen(true); }}
                    className="btn-primary"
                    style={{ padding: '0.75rem 1.5rem', background: 'var(--primary-color)', color: 'white', borderRadius: 'var(--radius-md)', fontWeight: 500 }}
                >
                    + {t.sites.addSite}
                </button>
            </div>

            <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {sites.map(site => (
                    <div key={site.id} className="clean-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{site.name}</h3>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
                                </div>
                            </div>
                            <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', background: '#eff6ff', color: '#2563eb', borderRadius: '4px', fontWeight: 500 }}>
                                {site.radius}m
                            </span>
                        </div>

                        <div style={{ height: '150px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                            <iframe
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                style={{ border: 0 }}
                                src={`https://maps.google.com/maps?q=${site.lat},${site.lng}&z=15&output=embed`}
                                allowFullScreen
                            ></iframe>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                            <button
                                onClick={() => setShowQR(site.id)}
                                style={{ flex: 1, padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.9rem' }}
                            >
                                QR Code
                            </button>
                            <button
                                onClick={() => handleEdit(site)}
                                style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--primary-color)', color: 'var(--primary-color)', borderRadius: '6px', fontSize: '0.9rem' }}
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => handleDelete(site.id)}
                                style={{ width: '40px', padding: '0.5rem', background: '#fee2e2', color: '#dc2626', borderRadius: '6px', fontSize: '0.9rem' }}
                            >
                                🗑
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="sidebar-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <form onSubmit={handleSave} className="clean-card" style={{ padding: '2rem', width: '90%', maxWidth: '500px', background: 'white' }}>
                        <h2 style={{ marginTop: 0 }}>{editingSite ? t.sites.editSite : t.sites.addSite}</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t.sites.siteName}</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t.sites.latitude}</label>
                                    <input
                                        required
                                        type="number" step="any"
                                        value={formData.lat}
                                        onChange={e => setFormData({ ...formData, lat: parseFloat(e.target.value) })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t.sites.longitude}</label>
                                    <input
                                        required
                                        type="number" step="any"
                                        value={formData.lng}
                                        onChange={e => setFormData({ ...formData, lng: parseFloat(e.target.value) })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={getCurrentLocation}
                                    style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                    📍 {t.sites.useCurrentLocation}
                                </button>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{t.sites.radius} (meters)</label>
                                <input
                                    required
                                    type="number"
                                    value={formData.radius}
                                    onChange={e => setFormData({ ...formData, radius: parseFloat(e.target.value) })}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                style={{ padding: '0.75rem 1.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                            >
                                {t.common.cancel}
                            </button>
                            <button
                                type="submit"
                                style={{ padding: '0.75rem 1.5rem', background: 'var(--primary-color)', color: 'white', borderRadius: '6px' }}
                            >
                                {t.common.save}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* QR Modal */}
            {showQR && (
                <div className="sidebar-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="clean-card" style={{ padding: '2rem', width: '90%', maxWidth: '400px', background: 'white', textAlign: 'center' }}>
                        <h2 style={{ marginTop: 0 }}>{sites.find(s => s.id === showQR)?.name}</h2>
                        <p style={{ color: '#666', marginBottom: '2rem' }}>Scan this QR Code to Check-In</p>

                        <div style={{ background: 'white', padding: '1rem', display: 'inline-block', border: '1px solid #eee', borderRadius: '8px' }}>
                            <QRCodeCanvas
                                value={JSON.stringify({
                                    siteId: showQR,
                                    timestamp: Date.now()
                                })}
                                size={200}
                                level="H"
                            />
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <button
                                onClick={() => setShowQR(null)}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
