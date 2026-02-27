import React, { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../context/PortalAuthContext';
import { useAppEmployees } from '../context/AppEmployeeContext';
import { appProfileRequestService } from '../services/appProfileRequestService';
import type { EmployeeProfileRequest, EmployeeProfileRequestStatus } from '../types/app';

type StatusFilter = EmployeeProfileRequestStatus | 'all';

const formatDateTime = (value: string): string => {
    if (!value) {
        return '-';
    }
    return new Date(value).toLocaleString('th-TH', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const AppProfileRequests: React.FC = () => {
    const { portalUser } = usePortalAuth();
    const { refreshEmployees } = useAppEmployees();

    const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
    const [requests, setRequests] = useState<EmployeeProfileRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const rows = await appProfileRequestService.listRequests(statusFilter);
            setRequests(rows);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'ไม่สามารถโหลดคำขอได้');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        void loadRequests();
    }, [loadRequests]);

    const approve = async (request: EmployeeProfileRequest) => {
        if (!portalUser) {
            return;
        }

        const shouldApprove = window.confirm(`อนุมัติคำขอของ ${request.employeeId} ใช่หรือไม่`);
        if (!shouldApprove) {
            return;
        }

        setNotice('');
        setError('');
        try {
            await appProfileRequestService.approveRequest(request.id, portalUser.username);
            await refreshEmployees();
            await loadRequests();
            setNotice(`อนุมัติคำขอ ${request.employeeId} แล้ว`);
        } catch (approveError) {
            setError(approveError instanceof Error ? approveError.message : 'ไม่สามารถอนุมัติคำขอได้');
        }
    };

    const reject = async (request: EmployeeProfileRequest) => {
        if (!portalUser) {
            return;
        }

        const note = window.prompt('เหตุผลในการปฏิเสธ (ไม่บังคับ):', '') || '';
        setNotice('');
        setError('');
        try {
            await appProfileRequestService.rejectRequest(request.id, portalUser.username, note);
            await loadRequests();
            setNotice(`ปฏิเสธคำขอ ${request.employeeId} แล้ว`);
        } catch (rejectError) {
            setError(rejectError instanceof Error ? rejectError.message : 'ไม่สามารถปฏิเสธคำขอได้');
        }
    };

    return (
        <div className="portal-grid reveal-up">
            <section className="panel">
                <div className="panel-head">
                    <h3>คำขอข้อมูลพนักงาน</h3>
                    <span>{statusFilter === 'pending' ? `Pending: ${requests.length}` : `Records: ${requests.length}`}</span>
                </div>

                <div className="filter-grid">
                    <div>
                        <label>สถานะ</label>
                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="all">All</option>
                        </select>
                    </div>
                </div>

                {loading ? <p className="panel-muted">กำลังโหลดข้อมูล...</p> : null}
                {error ? <div className="form-error">{error}</div> : null}
                {notice ? <p className="panel-muted">{notice}</p> : null}
            </section>

            <section className="panel table-panel">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>วันที่ส่ง</th>
                                <th>รหัสพนักงาน</th>
                                <th>ชื่อ</th>
                                <th>ประเภท</th>
                                <th>สถานะ</th>
                                <th>ผู้รีวิว</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map((request) => (
                                <tr key={request.id}>
                                    <td>{formatDateTime(request.createdAt)}</td>
                                    <td>{request.employeeId}</td>
                                    <td>
                                        <strong>{request.firstNameTH} {request.lastNameTH}</strong>
                                        <div className="panel-muted">{request.position} · {request.department}</div>
                                        <div className="panel-muted">
                                            เกิด: {request.birthDate || '-'} · ฉุกเฉิน: {request.emergencyContactName || '-'} ({request.emergencyContactPhone || '-'})
                                        </div>
                                    </td>
                                    <td>{request.requestType}</td>
                                    <td>{request.status}</td>
                                    <td>
                                        {request.reviewedBy || '-'}
                                        <div className="panel-muted">{formatDateTime(request.reviewedAt)}</div>
                                    </td>
                                    <td>
                                        {request.status === 'pending' ? (
                                            <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
                                                <button type="button" className="btn-primary" onClick={() => void approve(request)}>
                                                    อนุมัติ
                                                </button>
                                                <button type="button" className="btn-danger" onClick={() => void reject(request)}>
                                                    ปฏิเสธ
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="panel-muted">{request.reviewNote || '-'}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {requests.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={7}>
                                        <span className="panel-muted">ยังไม่มีข้อมูลคำขอ</span>
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};
