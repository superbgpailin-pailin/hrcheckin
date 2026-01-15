import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme, type ThemeColor } from '../context/ThemeContext';
import { getTranslation } from '../data/translations';
import { MOCK_EMPLOYEES } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useSettings, type Shift } from '../context/SettingsContext'; // Import Context
import type { Employee } from '../types';

// Mock Component for Toggles
const Toggle = ({ check, onChange, label }: { check: boolean; onChange: () => void; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f9fafb', borderRadius: '8px', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500, color: '#374151' }}>{label}</span>
        <button
            onClick={onChange}
            style={{
                width: '48px', height: '24px', borderRadius: '12px',
                background: check ? 'var(--success-color)' : '#d1d5db',
                position: 'relative', transition: 'background 0.2s'
            }}
        >
            <div style={{
                width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                position: 'absolute', top: '2px', left: check ? '26px' : '2px',
                transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }} />
        </button>
    </div>
);

export const Settings: React.FC = () => {
    const { language, toggleLanguage } = useLanguage();
    const { themeColor, setThemeColor, themeMode, setThemeMode } = useTheme();
    const { currentUser } = useAuth();
    const { config, updateConfig, saveConfig } = useSettings(); // Use Context
    const t = getTranslation(language);

    const [activeTab, setActiveTab] = useState<'system' | 'shifts' | 'lateness' | 'notifications' | 'admins' | 'features'>('system');
    const [admins, setAdmins] = useState<Employee[]>(MOCK_EMPLOYEES.filter(e => e.role === 'Admin'));

    // New Shift State
    const [newShift, setNewShift] = useState<Partial<Shift>>({ name: '', start: '', end: '', breakDuration: 60 });
    const [isAddingShift, setIsAddingShift] = useState(false);

    // New Rule State
    const [newRule, setNewRule] = useState({ minutes: '', amount: '' });

    // File Upload Handler
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateConfig({ logoUrl: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const addRule = () => {
        if (newRule.minutes && newRule.amount) {
            updateConfig({
                latenessRules: [...config.latenessRules, { minutes: parseInt(newRule.minutes), amount: parseInt(newRule.amount) }]
            });
            setNewRule({ minutes: '', amount: '' });
        }
    };

    const removeRule = (index: number) => {
        const newRules = [...config.latenessRules];
        newRules.splice(index, 1);
        updateConfig({ latenessRules: newRules });
    };

    const handleAddShift = () => {
        if (!newShift.name || !newShift.start || !newShift.end) return alert('Please fill required fields');
        const shift: Shift = {
            id: Date.now().toString(),
            name: newShift.name!,
            start: newShift.start!,
            end: newShift.end!,
            breakDuration: newShift.breakDuration || 60
        };
        updateConfig({ shifts: [...config.shifts, shift] });
        setIsAddingShift(false);
        setNewShift({ name: '', start: '', end: '', breakDuration: 60 });
    };

    const handleDeleteShift = (id: string) => {
        if (confirm('Delete this shift?')) {
            updateConfig({ shifts: config.shifts.filter(s => s.id !== id) });
        }
    };

    const SaveButton = () => (
        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
                onClick={saveConfig}
                style={{
                    padding: '1rem 3rem',
                    background: 'var(--success-color)',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    border: 'none',
                    cursor: 'pointer'
                }}
            >
                💾 {t.common.save}
            </button>
        </div>
    );

    const colors: { id: ThemeColor; color: string; label: string }[] = [
        { id: 'blue', color: '#2563eb', label: 'Ocean Blue' },
        { id: 'green', color: '#10b981', label: 'Emerald Green' },
        { id: 'purple', color: '#7c3aed', label: 'Royal Purple' },
        { id: 'orange', color: '#f97316', label: 'Sunset Orange' },
    ];

    return (
        <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h1 className="page-title" style={{ color: 'var(--primary-color)' }}>{t.menu.settings}</h1>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #e5e7eb', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {['system', 'shifts', 'lateness', 'notifications', 'admins', 'features'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        style={{
                            padding: '1rem 1.5rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            color: activeTab === tab ? 'var(--primary-color)' : '#6b7280',
                            borderBottom: activeTab === tab ? '2px solid var(--primary-color)' : '2px solid transparent',
                            textTransform: 'capitalize'
                        }}
                    >
                        {t.settings[tab as keyof typeof t.settings] || tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '2rem' }}>

                {/* SYSTEM SETTINGS */}
                {activeTab === 'system' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Theme Section */}
                        <div className="clean-card" style={{ padding: '2rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>🎨 {t.settings.theme}</h3>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                                {colors.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => setThemeColor(c.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                                            padding: '0.75rem 1rem',
                                            border: `2px solid ${themeColor === c.id ? c.color : 'var(--border-color)'}`,
                                            borderRadius: '0.5rem', background: 'var(--surface-color)',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                            boxShadow: themeColor === c.id ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                                            color: 'var(--text-primary)'
                                        }}
                                    >
                                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: c.color }} />
                                        <span style={{ fontWeight: 500, color: themeColor === c.id ? c.color : 'var(--text-secondary)' }}>{c.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 500, color: 'var(--text-primary)' }}>{t.settings.displayMode}</label>
                                <div style={{ display: 'inline-flex', background: 'var(--background-color)', padding: '0.25rem', borderRadius: '8px' }}>
                                    <button onClick={() => setThemeMode('light')} style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', background: themeMode === 'light' ? 'white' : 'transparent', color: themeMode === 'light' ? 'black' : 'var(--text-secondary)', fontWeight: 500, boxShadow: themeMode === 'light' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}>☀️ {t.settings.light}</button>
                                    <button onClick={() => setThemeMode('dark')} style={{ padding: '0.5rem 1.5rem', borderRadius: '6px', background: themeMode === 'dark' ? '#374151' : 'transparent', color: themeMode === 'dark' ? 'white' : 'var(--text-secondary)', fontWeight: 500, boxShadow: themeMode === 'dark' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none' }}>🌙 {t.settings.dark}</button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.settings.language}:</span>
                                <button onClick={toggleLanguage} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--background-color)', color: 'var(--text-primary)' }}>
                                    {language === 'th' ? '🇹🇭 ภาษาไทย' : '🇬🇧 English'}
                                </button>
                            </div>
                        </div>

                        {/* Company Info */}
                        <div className="clean-card" style={{ padding: '2rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>🏢 {t.settings.system}</h3>
                            <div style={{ display: 'grid', gap: '1.5rem', maxWidth: '600px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>{t.settings.companyName}</label>
                                    <input
                                        type="text"
                                        value={config.companyName}
                                        onChange={e => updateConfig({ companyName: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>{t.settings.logo}</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        {config.logoUrl && (
                                            <img src={config.logoUrl} alt="Logo" style={{ height: '60px', objectFit: 'contain' }} />
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            style={{ fontSize: '0.9rem' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rules Logic */}
                        <div className="clean-card" style={{ padding: '2rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>⚙️ {t.settings.title}</h3>
                            <div style={{ maxWidth: '600px' }}>
                                <Toggle label={t.settings.reqGeofence} check={config.geoFence} onChange={() => updateConfig({ geoFence: !config.geoFence })} />
                                <Toggle label={t.settings.reqSelfie} check={config.selfie} onChange={() => updateConfig({ selfie: !config.selfie })} />
                                <Toggle label={t.settings.reqQR} check={config.qrScan} onChange={() => updateConfig({ qrScan: !config.qrScan })} />
                            </div>
                        </div>
                        <SaveButton />
                    </div>
                )}

                {/* SHIFTS */}
                {activeTab === 'shifts' && (
                    <div className="clean-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3 style={{ margin: 0 }}>🕒 {t.settings.shifts}</h3>
                            <button onClick={() => setIsAddingShift(true)} style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', borderRadius: '6px' }}>+ Add Shift</button>
                        </div>

                        {isAddingShift && (
                            <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid var(--primary-color)', borderRadius: '8px', background: '#f0f9ff' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                    <input placeholder="Shift Name" value={newShift.name} onChange={e => setNewShift({ ...newShift, name: e.target.value })} style={{ padding: '0.5rem' }} />
                                    <input type="time" value={newShift.start} onChange={e => setNewShift({ ...newShift, start: e.target.value })} style={{ padding: '0.5rem' }} />
                                    <input type="time" value={newShift.end} onChange={e => setNewShift({ ...newShift, end: e.target.value })} style={{ padding: '0.5rem' }} />
                                    <input type="number" placeholder="Break (min)" value={newShift.breakDuration} onChange={e => setNewShift({ ...newShift, breakDuration: parseInt(e.target.value) })} style={{ padding: '0.5rem' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <button onClick={() => setIsAddingShift(false)}>Cancel</button>
                                    <button onClick={handleAddShift} style={{ background: 'var(--success-color)', color: 'white', padding: '0.5rem 1rem', borderRadius: '4px' }}>Save</button>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {config.shifts.map((shift) => (
                                <div key={shift.id} style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{shift.name}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#666' }}>{shift.start} - {shift.end} • Break: {shift.breakDuration} min</div>
                                    </div>
                                    <button onClick={() => handleDeleteShift(shift.id)} style={{ padding: '0.25rem 0.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: '4px' }}>🗑</button>
                                </div>
                            ))}
                        </div>
                        <SaveButton />
                    </div>
                )}

                {/* LATENESS SETTINGS */}
                {activeTab === 'lateness' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="clean-card" style={{ padding: '2rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>⏳ {t.settings.latenessSettings}</h3>

                            <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px dashed #e5e7eb' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>{t.settings.lateness}</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <input
                                        type="number"
                                        value={config.lateThreshold}
                                        onChange={e => updateConfig({ lateThreshold: parseInt(e.target.value) })}
                                        style={{ width: '120px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                                    />
                                    <span style={{ color: '#666' }}>mins</span>
                                </div>
                            </div>

                            <h4 style={{ marginBottom: '1rem', color: '#374151' }}>🛑 Penalty Rules (Tiered Deductions)</h4>
                            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#666' }}>{t.settings.lateMinutes} (&gt;)</label>
                                        <input
                                            type="number"
                                            placeholder="Min"
                                            value={newRule.minutes}
                                            onChange={e => setNewRule({ ...newRule, minutes: e.target.value })}
                                            style={{ width: '120px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', color: '#666' }}>{t.settings.deductionAmount}</label>
                                        <input
                                            type="number"
                                            placeholder="THB"
                                            value={newRule.amount}
                                            onChange={e => setNewRule({ ...newRule, amount: e.target.value })}
                                            style={{ width: '120px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                                        />
                                    </div>
                                    <button
                                        onClick={addRule}
                                        style={{
                                            padding: '0.5rem 1.5rem',
                                            background: 'var(--primary-color)',
                                            color: 'white',
                                            borderRadius: '6px',
                                            fontWeight: 600,
                                            border: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        + {t.settings.addRule}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {config.latenessRules.map((rule, idx) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'white', borderRadius: '6px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span style={{ background: '#fee2e2', color: '#dc2626', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                                                Late &gt; {rule.minutes} min
                                            </span>
                                            <span style={{ color: '#9ca3af' }}>➜</span>
                                            <span style={{ fontWeight: 600, color: '#374151' }}>
                                                Deduct {rule.amount.toLocaleString()} {t.settings.baht}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeRule(idx)}
                                            style={{ color: '#ef4444', padding: '0.25rem 0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <SaveButton />
                    </div>
                )}

                {/* NOTIFICATIONS */}
                {activeTab === 'notifications' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className="clean-card" style={{ padding: '2rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>🔔 {t.settings.notifications}</h3>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Line Notify Token</label>
                                <input
                                    type="password"
                                    value={config.lineToken}
                                    onChange={e => updateConfig({ lineToken: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Telegram Bot Token</label>
                                <input
                                    type="password"
                                    value={config.telegramToken}
                                    onChange={e => updateConfig({ telegramToken: e.target.value })}
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                                />
                            </div>
                        </div>
                        <div className="clean-card" style={{ padding: '2rem' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>📢 Alert Triggers</h3>
                            <div style={{ maxWidth: '600px' }}>
                                <Toggle label="Notify on Employee Check-in/out" check={config.notifyCheckIn} onChange={() => updateConfig({ notifyCheckIn: !config.notifyCheckIn })} />
                                <Toggle label="Notify on New Leave Request" check={config.notifyRequest} onChange={() => updateConfig({ notifyRequest: !config.notifyRequest })} />
                            </div>
                        </div>
                        <SaveButton />
                    </div>
                )}

                {/* ADMINS */}
                {activeTab === 'admins' && (
                    <div className="clean-card" style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h3 style={{ margin: 0 }}>🛡️ {t.settings.admins}</h3>
                            <button style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', borderRadius: '6px' }}>+ {t.settings.addAdmin}</button>
                        </div>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {admins.map(admin => (
                                <div key={admin.id} style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <img src={admin.photoUrl} alt="Avatar" style={{ width: 40, height: 40, borderRadius: '50%' }} />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{language === 'th' ? admin.firstNameTH : admin.firstNameEN}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>ID: {admin.id}</div>
                                        </div>
                                    </div>
                                    <button disabled={currentUser?.id !== 'CR001' || admin.id === 'CR001'} style={{ padding: '0.5rem 1rem', background: (currentUser?.id === 'CR001' && admin.id !== 'CR001') ? '#fee2e2' : '#f3f4f6', color: (currentUser?.id === 'CR001' && admin.id !== 'CR001') ? '#dc2626' : '#9ca3af', borderRadius: '6px', cursor: (currentUser?.id === 'CR001' && admin.id !== 'CR001') ? 'pointer' : 'not-allowed', border: 'none' }} onClick={() => { if (confirm(`Remove admin ${admin.firstNameEN}?`)) { setAdmins(admins.filter(a => a.id !== admin.id)); } }}>{t.common.delete}</button>
                                </div>
                            ))}
                        </div>
                        {currentUser?.id !== 'CR001' && (
                            <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#f59e0b', background: '#fffbeb', padding: '0.5rem', borderRadius: '4px' }}>ℹ️ {t.settings.cantDeleteAdmin}</div>
                        )}
                    </div>
                )}

                {/* FEATURE TOGGLES */}
                {activeTab === 'features' && (
                    <div className="clean-card" style={{ padding: '2rem' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1.5rem' }}>🔧 {language === 'th' ? 'เปิด/ปิด ฟังก์ชัน' : 'Enable/Disable Features'}</h3>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            {language === 'th' ? 'เลือกฟังก์ชันที่ต้องการเปิดหรือปิดในระบบ' : 'Select features to enable or disable in the system'}
                        </p>

                        <Toggle
                            check={config.featureHolidaySelection}
                            onChange={() => updateConfig({ featureHolidaySelection: !config.featureHolidaySelection })}
                            label={language === 'th' ? '🗓️ เลือกวันหยุด (พนักงาน)' : '🗓️ Holiday Selection (Employee)'}
                        />
                        <Toggle
                            check={config.featureTimeCorrection}
                            onChange={() => updateConfig({ featureTimeCorrection: !config.featureTimeCorrection })}
                            label={language === 'th' ? '⏰ ขอแก้ไขเวลา (พนักงาน)' : '⏰ Time Correction (Employee)'}
                        />
                        <Toggle
                            check={config.featureGeofenceCheck}
                            onChange={() => updateConfig({ featureGeofenceCheck: !config.featureGeofenceCheck })}
                            label={language === 'th' ? '📍 ตรวจสอบพิกัดก่อนเช็คอิน' : '📍 Geofence Check Before Check-in'}
                        />
                        <Toggle
                            check={config.featureSelfieCheck}
                            onChange={() => updateConfig({ featureSelfieCheck: !config.featureSelfieCheck })}
                            label={language === 'th' ? '📷 ถ่ายรูปก่อนเช็คอิน' : '📷 Selfie Before Check-in'}
                        />

                        <SaveButton />
                    </div>
                )}
            </div>
        </div>
    );
};
