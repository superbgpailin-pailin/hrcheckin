import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { useLeave } from '../context/LeaveContext';
import { useEmployee } from '../context/EmployeeContext';

export const LeaveRequest: React.FC = () => {
    const { language } = useLanguage();
    getTranslation(language); // For future use
    const { requests, approveRequest, rejectRequest } = useLeave();
    const { employees } = useEmployee();
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    const getEmployeeName = (empId: string) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return empId;
        return language === 'th' ? `${emp.firstNameTH} ${emp.lastNameTH}` : `${emp.firstNameEN} ${emp.lastNameEN}`;
    };

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const processedRequests = requests.filter(r => r.status !== 'pending');

    const handleApprove = (id: string) => {
        approveRequest(id, 'ADMIN');
    };

    const handleReject = (id: string) => {
        if (!rejectReason.trim()) {
            alert(language === 'th' ? 'กรุณาระบุเหตุผล' : 'Please enter a reason');
            return;
        }
        rejectRequest(id, 'ADMIN', rejectReason);
        setRejectReason('');
        setRejectingId(null);
    };

    const getStatusBadge = (status: string) => {
        const styles: any = {
            pending: { bg: '#fef3c7', color: '#d97706' },
            approved: { bg: '#dcfce7', color: '#15803d' },
            rejected: { bg: '#fee2e2', color: '#dc2626' }
        };
        const labels: any = {
            pending: language === 'th' ? 'รอดำเนินการ' : 'Pending',
            approved: language === 'th' ? 'อนุมัติแล้ว' : 'Approved',
            rejected: language === 'th' ? 'ไม่อนุมัติ' : 'Rejected'
        };
        return (
            <span style={{ background: styles[status].bg, color: styles[status].color, padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 600 }}>
                {labels[status]}
            </span>
        );
    };

    return (
        <div className="page-container">
            <h1 className="page-title">⏰ {language === 'th' ? 'คำขอแก้ไขเวลา' : 'Time Correction Requests'}</h1>

            {/* Pending Requests */}
            <div className="clean-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>
                    🔔 {language === 'th' ? 'รอดำเนินการ' : 'Pending Requests'}
                    <span style={{
                        background: pendingRequests.length > 0 ? '#fef3c7' : '#f3f4f6',
                        color: pendingRequests.length > 0 ? '#d97706' : '#6b7280',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.9rem',
                        marginLeft: '0.75rem'
                    }}>
                        {pendingRequests.length}
                    </span>
                </h3>

                {pendingRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                        {language === 'th' ? 'ไม่มีคำขอที่รอดำเนินการ' : 'No pending requests'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {pendingRequests.map(req => (
                            <div key={req.id} style={{
                                padding: '1rem',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                background: '#f9fafb'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{getEmployeeName(req.employeeId)}</div>
                                        <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{req.employeeId}</div>
                                    </div>
                                    {getStatusBadge(req.status)}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{language === 'th' ? 'วันที่' : 'Date'}</div>
                                        <div style={{ fontWeight: 500 }}>{req.date}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{language === 'th' ? 'เวลาเข้าใหม่' : 'New Check-In'}</div>
                                        <div style={{ fontWeight: 500, color: '#2563eb' }}>{req.newCheckIn || '-'}</div>
                                    </div>
                                    <div>
                                        <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{language === 'th' ? 'เวลาออกใหม่' : 'New Check-Out'}</div>
                                        <div style={{ fontWeight: 500, color: '#2563eb' }}>{req.newCheckOut || '-'}</div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{language === 'th' ? 'เหตุผล' : 'Reason'}</div>
                                    <div style={{ fontWeight: 500 }}>{req.reason}</div>
                                </div>

                                {rejectingId === req.id ? (
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={rejectReason}
                                            onChange={e => setRejectReason(e.target.value)}
                                            placeholder={language === 'th' ? 'ระบุเหตุผลไม่อนุมัติ...' : 'Enter rejection reason...'}
                                            style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                                        />
                                        <button
                                            onClick={() => handleReject(req.id)}
                                            style={{ padding: '0.5rem 1rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                        >
                                            {language === 'th' ? 'ยืนยัน' : 'Confirm'}
                                        </button>
                                        <button
                                            onClick={() => { setRejectingId(null); setRejectReason(''); }}
                                            style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                        >
                                            {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleApprove(req.id)}
                                            style={{ flex: 1, padding: '0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            ✓ {language === 'th' ? 'อนุมัติ' : 'Approve'}
                                        </button>
                                        <button
                                            onClick={() => setRejectingId(req.id)}
                                            style={{ flex: 1, padding: '0.75rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            ✗ {language === 'th' ? 'ไม่อนุมัติ' : 'Reject'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Processed Requests */}
            <div className="clean-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>
                    📋 {language === 'th' ? 'ประวัติคำขอ' : 'Request History'}
                </h3>

                {processedRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                        {language === 'th' ? 'ยังไม่มีประวัติ' : 'No history yet'}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f9fafb' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280' }}>{language === 'th' ? 'พนักงาน' : 'Employee'}</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280' }}>{language === 'th' ? 'วันที่' : 'Date'}</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280' }}>{language === 'th' ? 'เวลาใหม่' : 'New Time'}</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280' }}>{language === 'th' ? 'สถานะ' : 'Status'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedRequests.sort((a, b) => new Date(b.reviewedAt || b.createdAt).getTime() - new Date(a.reviewedAt || a.createdAt).getTime()).map(req => (
                                    <tr key={req.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{getEmployeeName(req.employeeId)}</td>
                                        <td style={{ padding: '0.75rem' }}>{req.date}</td>
                                        <td style={{ padding: '0.75rem', color: '#2563eb' }}>{req.newCheckIn || '-'} - {req.newCheckOut || '-'}</td>
                                        <td style={{ padding: '0.75rem' }}>{getStatusBadge(req.status)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
