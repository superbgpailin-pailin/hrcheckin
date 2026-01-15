import React, { useState } from 'react';
import { PublicUserAuth } from '../components/PublicUserAuth';
import { TimeAttendance } from './TimeAttendance';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';

export const CheckInFlow: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    // Steps: 1 = Shift, 2 = Auth, 3 = Attendance
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedShift, setSelectedShift] = useState('');
    const { login } = useAuth();
    const { language } = useLanguage();
    const t = getTranslation(language);

    // Mocks
    const shifts = ['Morning (08:00 - 17:00)', 'Afternoon (13:00 - 22:00)', 'Night (22:00 - 07:00)'];

    const handleShiftSelect = (shift: string) => {
        setSelectedShift(shift);
        setStep(2);
    };

    const handleAuth = (employee: any) => {
        login(employee.id);
        setStep(3);
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
            {/* Header / Progress */}
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                {[1, 2, 3].map(s => (
                    <div key={s} style={{
                        width: '30px', height: '30px', borderRadius: '50%',
                        background: step >= s ? 'var(--primary-color)' : '#e2e8f0',
                        color: step >= s ? 'white' : '#64748b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 600
                    }}>
                        {s}
                    </div>
                ))}
            </div>

            {/* Step 1: Shift Selection */}
            {step === 1 && (
                <div>
                    <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>🕒 Select Shift</h2>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {shifts.map(shift => (
                            <button
                                key={shift}
                                onClick={() => handleShiftSelect(shift)}
                                style={{
                                    padding: '1.5rem',
                                    borderRadius: '1rem',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--surface-color)',
                                    fontSize: '1.1rem',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                }}
                            >
                                {shift} <span>➜</span>
                            </button>
                        ))}
                    </div>
                    <button onClick={onBack} style={{ marginTop: '0.5rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', width: '100%' }}>
                        ✖ {t.common.cancel}
                    </button>
                </div>
            )}

            {/* Step 2: Auth */}
            {step === 2 && (
                <PublicUserAuth
                    onAuthenticated={handleAuth}
                    onCancel={() => setStep(1)}
                />
            )}

            {/* Step 3: Actual TimeAttendance */}
            {step === 3 && (
                <div>
                    <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', color: '#0369a1' }}>
                        <strong>Shift:</strong> {selectedShift}
                    </div>
                    <TimeAttendance />
                </div>
            )}
        </div>
    );
};
