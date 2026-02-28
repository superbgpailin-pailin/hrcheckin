import React, { useEffect, useMemo, useState } from 'react';
import { useAppEmployees } from '../context/AppEmployeeContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { ImageLightbox } from '../components/ImageLightbox';
import { appAttendanceService } from '../services/appAttendanceService';
import type { AttendanceSummaryRecord } from '../types/app';
import { downloadCsv } from '../utils/csv';
import { formatThaiDateTime } from '../utils/shiftUtils';

const getEmployeeLabel = (record: AttendanceSummaryRecord): string => {
    const normalized = record.employeeName.trim();
    return normalized || record.employeeId;
};

export const AppAttendance: React.FC = () => {
    const { employees } = useAppEmployees();
    const { config } = useAppSettings();

    const [records, setRecords] = useState<AttendanceSummaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState('');
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [fromDate, setFromDate] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
    const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
    const [employeeId, setEmployeeId] = useState('all');
    const [previewPhoto, setPreviewPhoto] = useState<{ src: string; alt: string } | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deletingBulk, setDeletingBulk] = useState(false);

    const [editingRecord, setEditingRecord] = useState<AttendanceSummaryRecord | null>(null);
    const [editShiftId, setEditShiftId] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editTime, setEditTime] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        setNotice('');
        setSelectedIds(new Set());

        try {
            const result = await appAttendanceService.listCheckIns(
                config.shifts,
                employees,
                config.lateGraceMinutes,
                {
                    from: fromDate,
                    to: toDate,
                    employeeId: employeeId === 'all' ? undefined : employeeId,
                },
            );
            setRecords(result);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load attendance log');
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === records.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(records.map((r) => r.id)));
        }
    };

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return;

        const shouldDelete = window.confirm(`Delete ${selectedIds.size} selected check-ins?`);
        if (!shouldDelete) return;

        setDeletingBulk(true);
        setError('');
        setNotice('');

        try {
            await appAttendanceService.deleteCheckIns(Array.from(selectedIds));
            setNotice(`${selectedIds.size} check-ins deleted successfully.`);
            await load();
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete check-ins');
        } finally {
            setDeletingBulk(false);
        }
    };

    const deleteCheckIn = async (record: AttendanceSummaryRecord) => {
        const shouldDelete = window.confirm(
            `Delete check-in for ${record.employeeId} at ${formatThaiDateTime(record.checkInAt)}?`,
        );
        if (!shouldDelete) {
            return;
        }

        setDeletingId(record.id);
        setError('');
        setNotice('');

        try {
            await appAttendanceService.deleteCheckIn(record.id);
            setNotice('Check-in deleted successfully.');
            await load();
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete check-in');
        } finally {
            setDeletingId('');
        }
    };

    const startEdit = (record: AttendanceSummaryRecord) => {
        setEditingRecord(record);
        setEditShiftId(record.shiftId);
        const dt = new Date(record.checkInAt);
        const pad = (n: number) => n.toString().padStart(2, '0');
        setEditDate(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`);
        setEditTime(`${pad(dt.getHours())}:${pad(dt.getMinutes())}`);
    };

    const cancelEdit = () => {
        setEditingRecord(null);
    };

    const saveEdit = async () => {
        if (!editingRecord) return;
        const confirmEdit = window.confirm(`กำลังบันทึกการแก้ไขข้อมูลของ ${editingRecord.employeeId} ใช่หรือไม่?`);
        if (!confirmEdit) return;

        setError('');
        setNotice('');
        setLoading(true);

        try {
            const shiftObj = config.shifts.find(s => s.id === editShiftId) || config.shifts[0];
            const newIso = new Date(`${editDate}T${editTime}:00`).toISOString();

            await appAttendanceService.updateCheckIn(editingRecord.id, {
                shift_name: shiftObj.id,
                shift: shiftObj.id,
                timestamp: newIso,
                check_in_time: newIso
            });

            setNotice('แก้ไขข้อมูลสำเร็จ');
            setEditingRecord(null);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'แก้ไขไม่สำเร็จ');
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.lateGraceMinutes, config.shifts, employees]);

    const stats = useMemo(() => {
        const unique = new Set(records.map((record) => `${record.employeeId}:${record.checkInAt.slice(0, 10)}:${record.shiftId}`));
        const late = records.filter((record) => record.status === 'Late').length;
        return {
            rows: records.length,
            uniqueShifts: unique.size,
            lateRows: late,
        };
    }, [records]);

    const exportCheckInCsv = () => {
        const rows = records.map((record) => ({
            employee_id: record.employeeId,
            employee_name: record.employeeName,
            role: record.role,
            department: record.department,
            shift: record.shiftLabel,
            check_in_at: formatThaiDateTime(record.checkInAt),
            estimated_shift_end: formatThaiDateTime(record.estimatedCheckOutAt),
            status: record.status,
            late_minutes: record.lateMinutes,
            kiosk_id: record.kioskId,
            photo_url: record.photoUrl,
        }));

        downloadCsv(`attendance_log_${fromDate}_${toDate}.csv`, rows);
    };

    return (
        <div className="portal-grid reveal-up">
            <section className="panel">
                <div className="panel-head">
                    <h3>Attendance Log Filters</h3>
                    <button type="button" className="btn-primary" onClick={load}>Refresh</button>
                </div>

                <div className="filter-grid">
                    <div>
                        <label>From</label>
                        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                    </div>
                    <div>
                        <label>To</label>
                        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                    </div>
                    <div>
                        <label>Employee</label>
                        <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                            <option value="all">All</option>
                            {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                    {employee.id} - {(employee.nickname || `${employee.firstNameTH} ${employee.lastNameTH}`).trim()}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="inline-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div className="panel-muted">
                        Log rows {stats.rows} | unique day-shifts {stats.uniqueShifts} | late {stats.lateRows}
                    </div>
                    <div className="inline-actions">
                        {selectedIds.size > 0 ? (
                            <button
                                type="button"
                                className="btn-danger"
                                onClick={() => void deleteSelected()}
                                disabled={deletingBulk}
                            >
                                {deletingBulk ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
                            </button>
                        ) : null}
                        <button type="button" className="btn-muted" onClick={exportCheckInCsv}>Export Log CSV</button>
                    </div>
                </div>

                {error ? <div className="form-error">{error}</div> : null}
                {notice ? <p className="panel-muted">{notice}</p> : null}
            </section>

            <section className="panel table-panel">
                <div className="panel-head">
                    <h3>Check-in Log</h3>
                    <span>{records.length} rows</span>
                </div>

                {loading ? <p className="panel-muted">Loading attendance log...</p> : null}

                {!loading && records.length === 0 ? (
                    <p className="panel-muted">No check-in records found for the selected range.</p>
                ) : null}

                {!loading && records.length > 0 ? (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            checked={records.length > 0 && selectedIds.size === records.length}
                                            onChange={toggleAll}
                                        />
                                    </th>
                                    <th>Employee</th>
                                    <th>Shift</th>
                                    <th>Check-in</th>
                                    <th>Shift End</th>
                                    <th>Status</th>
                                    <th>Late (min)</th>
                                    <th>Photo</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((record) => (
                                    <tr key={record.id} className={selectedIds.has(record.id) ? 'selected-row' : ''}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(record.id)}
                                                onChange={() => toggleSelection(record.id)}
                                            />
                                        </td>
                                        <td>
                                            <strong>{getEmployeeLabel(record)}</strong>
                                            <div className="panel-muted">{record.employeeId}</div>
                                        </td>
                                        <td>{record.shiftLabel}</td>
                                        <td>{formatThaiDateTime(record.checkInAt)}</td>
                                        <td>{formatThaiDateTime(record.estimatedCheckOutAt)}</td>
                                        <td>
                                            <span className={`status-pill ${record.status === 'Late' ? 'late' : 'on-time'}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                        <td>{record.lateMinutes}</td>
                                        <td>
                                            {record.photoUrl ? (
                                                <button
                                                    type="button"
                                                    className="image-preview-trigger attendance-selfie-trigger"
                                                    onClick={() => setPreviewPhoto({
                                                        src: record.photoUrl,
                                                        alt: `${record.employeeId} check-in photo`,
                                                    })}
                                                >
                                                    <img
                                                        src={record.photoUrl}
                                                        alt={`${record.employeeId} check-in photo`}
                                                        className="attendance-selfie-thumb"
                                                    />
                                                </button>
                                            ) : (
                                                <div className="panel-muted">-</div>
                                            )}
                                        </td>
                                        <td>
                                            <div className="inline-actions" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                                <button
                                                    type="button"
                                                    className="btn-muted"
                                                    onClick={() => startEdit(record)}
                                                    disabled={deletingId === record.id}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-danger"
                                                    onClick={() => void deleteCheckIn(record)}
                                                    disabled={deletingId === record.id}
                                                >
                                                    {deletingId === record.id ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </section>

            {editingRecord ? (
                <div className="modal-backdrop" onClick={cancelEdit}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-icon">✏️</div>
                        <h3>แก้ไข Check-in</h3>
                        <p style={{ fontWeight: 600, fontSize: '1.05rem', color: '#0f172a' }}>{editingRecord.employeeName}</p>

                        <div className="stack-form" style={{ marginTop: '1rem', textAlign: 'left' }}>
                            <label>กะทำงาน (Shift)</label>
                            <select value={editShiftId} onChange={(e) => setEditShiftId(e.target.value)}>
                                {config.shifts.map(s => (
                                    <option key={s.id} value={s.id}>{s.label} ({s.start}-{s.end})</option>
                                ))}
                            </select>

                            <label>วันที่</label>
                            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />

                            <label>เวลา</label>
                            <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                        </div>

                        <div className="modal-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button type="button" className="btn-muted" onClick={cancelEdit}>ยกเลิก</button>
                            <button type="button" className="btn-primary" onClick={() => void saveEdit()}>บันทึกการแก้ไข</button>
                        </div>
                    </div>
                </div>
            ) : null}

            {previewPhoto ? (
                <ImageLightbox
                    imageUrl={previewPhoto.src}
                    alt={previewPhoto.alt}
                    onClose={() => setPreviewPhoto(null)}
                />
            ) : null}
        </div>
    );
};
