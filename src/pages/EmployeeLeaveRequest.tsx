import React, { useState } from 'react';
import { PublicUserAuth } from '../components/PublicUserAuth';
import { useLanguage } from '../context/LanguageContext';
import { useLeave } from '../context/LeaveContext';

export const EmployeeLeaveRequest: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { language } = useLanguage();
    const { addRequest, getRequestsByEmployee } = useLeave();

    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<any>(null);

    // Time correction form
    const [correctionDate, setCorrectionDate] = useState('');
    const [newCheckIn, setNewCheckIn] = useState('');
    const [newCheckOut, setNewCheckOut] = useState('');
    const [correctionReason, setCorrectionReason] = useState('');

    const handleAuth = (employee: any) => {
        setCurrentEmployee(employee);
        setIsAuthenticated(true);
    };

    const handleSubmitTimeCorrection = () => {
        if (!correctionDate || (!newCheckIn && !newCheckOut) || !correctionReason) {
            alert(language === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Please fill all fields');
            return;
        }
        addRequest({
            employeeId: currentEmployee.id,
            type: 'timeCorrection',
            date: correctionDate,
            newCheckIn: newCheckIn || undefined,
            newCheckOut: newCheckOut || undefined,
            reason: correctionReason
        });
        alert(language === 'th' ? 'ส่งคำขอแก้เวลาสำเร็จ!' : 'Time correction request submitted!');
        setCorrectionDate('');
        setNewCheckIn('');
        setNewCheckOut('');
        setCorrectionReason('');
    };

    const myRequests = currentEmployee ? getRequestsByEmployee(currentEmployee.id) : [];

    const getStatusBadge = (status: string) => {
        const styles: any = {
            pending: { bg: '#fef3c7', color: '#d97706' },
            approved: { bg: '#dcfce7', color: '#15803d' },
            rejected: { bg: '#fee2e2', color: '#dc2626' }
        };
        const labels: any = {
            pending: language === 'th' ? 'รอดำเนินการ' : 'Pending',
            approved: language === 'th' ? 'อนุมัติ' : 'Approved',
            rejected: language === 'th' ? 'ไม่อนุมัติ' : 'Rejected'
        };
        return (
            <span style={{ background: styles[status].bg, color: styles[status].color, padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                {labels[status]}
            </span>
        );
    };

    // Not authenticated
    if (!isAuthenticated) {
        return (
            <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    ⏰ {language === 'th' ? 'ขอแก้ไขเวลา' : 'Time Correction'}
                </h2>
                <PublicUserAuth onAuthenticated={handleAuth} onCancel={onBack} />
                <button
                    onClick={onBack}
                    style={{ marginTop: '1rem', width: '100%', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                >
                    ✖ {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
            {/* Header */}
            <div style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img
                        src={currentEmployee?.photoUrl || 'https://ui-avatars.com/api/?background=random'}
                        alt=""
                        style={{ width: 50, height: 50, borderRadius: '50%' }}
                    />
                    <div>
                        <h3 style={{ margin: 0 }}>
                            {language === 'th'
                                ? `${currentEmployee?.firstNameTH} ${currentEmployee?.lastNameTH}`
                                : `${currentEmployee?.firstNameEN} ${currentEmployee?.lastNameEN}`}
                        </h3>
                        <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{currentEmployee?.id}</div>
                    </div>
                </div>
                <button
                    onClick={onBack}
                    style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                    {language === 'th' ? 'ออก' : 'Exit'}
                </button>
            </div>

            {/* Time Correction Form */}
            <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginTop: 0 }}>⏰ {language === 'th' ? 'ขอแก้ไขเวลา' : 'Request Time Correction'}</h3>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                        {language === 'th' ? 'วันที่ต้องการแก้ไข' : 'Date to Correct'}
                    </label>
                    <input
                        type="date"
                        value={correctionDate}
                        onChange={e => setCorrectionDate(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            {language === 'th' ? 'เวลาเข้าใหม่' : 'New Check-In'}
                        </label>
                        <input
                            type="time"
                            value={newCheckIn}
                            onChange={e => setNewCheckIn(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            {language === 'th' ? 'เวลาออกใหม่' : 'New Check-Out'}
                        </label>
                        <input
                            type="time"
                            value={newCheckOut}
                            onChange={e => setNewCheckOut(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                        {language === 'th' ? 'เหตุผล' : 'Reason'}
                    </label>
                    <textarea
                        value={correctionReason}
                        onChange={e => setCorrectionReason(e.target.value)}
                        rows={3}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', resize: 'none' }}
                        placeholder={language === 'th' ? 'เช่น ลืมเช็คอิน, ระบบขัดข้อง...' : 'e.g., Forgot to check in, system error...'}
                    />
                </div>

                <button
                    onClick={handleSubmitTimeCorrection}
                    style={{ width: '100%', padding: '0.75rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}
                >
                    {language === 'th' ? '📤 ส่งคำขอแก้เวลา' : '📤 Submit Time Correction'}
                </button>
            </div>

            {/* Request History */}
            <div style={{ background: 'white', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginTop: 0 }}>📋 {language === 'th' ? 'ประวัติคำขอ' : 'Request History'}</h3>

                {myRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                        {language === 'th' ? 'ยังไม่มีคำขอ' : 'No requests yet'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {myRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(req => (
                            <div key={req.id} style={{
                                padding: '1rem',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                background: '#f9fafb'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: 600 }}>
                                        ⏰ {language === 'th' ? 'แก้เวลา' : 'Time Correction'}
                                    </span>
                                    {getStatusBadge(req.status)}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                    <div>{language === 'th' ? 'วันที่:' : 'Date:'} {req.date}</div>
                                    <div>
                                        {language === 'th' ? 'เวลาใหม่:' : 'New Time:'} {req.newCheckIn || '-'} - {req.newCheckOut || '-'}
                                    </div>
                                    <div>{language === 'th' ? 'เหตุผล:' : 'Reason:'} {req.reason}</div>
                                    {req.status === 'rejected' && req.rejectReason && (
                                        <div style={{ color: '#dc2626' }}>
                                            {language === 'th' ? 'เหตุผลไม่อนุมัติ:' : 'Rejection Reason:'} {req.rejectReason}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
