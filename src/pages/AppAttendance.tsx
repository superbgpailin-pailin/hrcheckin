import React, { useEffect, useMemo, useState } from 'react';
import { useAppEmployees } from '../context/AppEmployeeContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { appAttendanceService } from '../services/appAttendanceService';
import type { AttendanceSummaryRecord } from '../types/app';
import { downloadCsv } from '../utils/csv';
import { formatThaiDateTime } from '../utils/shiftUtils';

export const AppAttendance: React.FC = () => {
    const { employees } = useAppEmployees();
    const { config } = useAppSettings();

    const [records, setRecords] = useState<AttendanceSummaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [fromDate, setFromDate] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
    const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
    const [employeeId, setEmployeeId] = useState('all');

    const load = async () => {
        setLoading(true);
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
        setLoading(false);
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

    const exportCsv = () => {
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
        }));

        downloadCsv(`attendance_${fromDate}_${toDate}.csv`, rows);
    };

    return (
        <div className="portal-grid reveal-up">
            <section className="panel">
                <div className="panel-head">
                    <h3>ตัวกรองรายการเช็คอิน</h3>
                    <button type="button" className="btn-primary" onClick={load}>รีเฟรช</button>
                </div>

                <div className="filter-grid">
                    <div>
                        <label>จากวันที่</label>
                        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                    </div>
                    <div>
                        <label>ถึงวันที่</label>
                        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                    </div>
                    <div>
                        <label>พนักงาน</label>
                        <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                            <option value="all">ทั้งหมด</option>
                            {employees.map((employee) => (
                                <option key={employee.id} value={employee.id}>
                                    {employee.id} - {employee.firstNameTH} {employee.lastNameTH}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
                    <div className="panel-muted">
                        ทั้งหมด {stats.rows} รายการ · กะที่ไม่ซ้ำ {stats.uniqueShifts} · สาย {stats.lateRows}
                    </div>
                    <button type="button" className="btn-muted" onClick={exportCsv}>Export CSV</button>
                </div>
            </section>

            <section className="panel table-panel">
                {loading ? <p className="panel-muted">กำลังโหลดข้อมูล...</p> : null}

                {!loading && records.length === 0 ? (
                    <p className="panel-muted">ไม่พบข้อมูลในช่วงวันที่ที่เลือก</p>
                ) : null}

                {!loading && records.length > 0 ? (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>พนักงาน</th>
                                    <th>กะ</th>
                                    <th>เวลาเข้า</th>
                                    <th>เวลาสิ้นสุดกะ (ประมาณ)</th>
                                    <th>สถานะ</th>
                                    <th>สาย (นาที)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((record) => (
                                    <tr key={record.id}>
                                        <td>
                                            <strong>{record.employeeName}</strong>
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </section>
        </div>
    );
};
