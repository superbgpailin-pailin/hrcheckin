import React, { useEffect, useMemo, useState } from 'react';
import { useAppEmployees } from '../context/AppEmployeeContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { appAttendanceService } from '../services/appAttendanceService';
import type { AttendanceEmployeeReportRow, AttendanceSummaryRecord, LatePenaltyRule } from '../types/app';
import { downloadCsv } from '../utils/csv';
import { dayKey, formatThaiDateTime } from '../utils/shiftUtils';

const buildDateRange = (from: string, to: string): string[] => {
    if (!from || !to || from > to) {
        return [];
    }

    const result: string[] = [];
    const cursor = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);

    while (cursor.getTime() <= end.getTime()) {
        result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
        cursor.setDate(cursor.getDate() + 1);
    }

    return result;
};

const monthFromIso = (iso: string): string => {
    const date = new Date(iso);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const sortRules = (rules: LatePenaltyRule[]): LatePenaltyRule[] => {
    return [...rules].sort((a, b) => a.minMinutes - b.minMinutes);
};

const matchesRule = (minutes: number, rule: LatePenaltyRule): boolean => {
    if (minutes < rule.minMinutes) {
        return false;
    }
    if (rule.maxMinutes !== null && minutes > rule.maxMinutes) {
        return false;
    }
    return true;
};

const calculateLatePenalty = (records: AttendanceSummaryRecord[], rules: LatePenaltyRule[]): number => {
    if (!records.length || !rules.length) {
        return 0;
    }

    const sortedRules = sortRules(rules);
    let total = 0;
    const monthlyMinutesByRule = new Map<string, number>();

    records.forEach((record) => {
        if (record.lateMinutes <= 0) {
            return;
        }

        const matchedRule = sortedRules.find((rule) => matchesRule(record.lateMinutes, rule));
        if (!matchedRule) {
            return;
        }

        total += matchedRule.deductionAmount;

        if (
            matchedRule.monthlyAccumulatedMinutesThreshold !== null
            && matchedRule.monthlyAccumulatedDeduction !== null
        ) {
            const key = `${matchedRule.id}:${monthFromIso(record.checkInAt)}`;
            monthlyMinutesByRule.set(key, (monthlyMinutesByRule.get(key) || 0) + record.lateMinutes);
        }
    });

    monthlyMinutesByRule.forEach((minutes, key) => {
        const [ruleId] = key.split(':');
        const rule = sortedRules.find((item) => item.id === ruleId);
        if (!rule) {
            return;
        }

        if (
            rule.monthlyAccumulatedMinutesThreshold !== null
            && rule.monthlyAccumulatedDeduction !== null
            && minutes > rule.monthlyAccumulatedMinutesThreshold
        ) {
            total += rule.monthlyAccumulatedDeduction;
        }
    });

    return total;
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

    const load = async () => {
        setLoading(true);
        setError('');
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

    const deleteCheckIn = async (record: AttendanceSummaryRecord) => {
        const shouldDelete = window.confirm(
            `ลบรายการเช็คอิน ${record.employeeId} เวลา ${formatThaiDateTime(record.checkInAt)} ใช่หรือไม่`,
        );
        if (!shouldDelete) {
            return;
        }

        setDeletingId(record.id);
        setError('');
        setNotice('');

        try {
            await appAttendanceService.deleteCheckIn(record.id);
            setNotice('ลบรายการเช็คอินเรียบร้อยแล้ว');
            await load();
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'ลบรายการไม่สำเร็จ');
        } finally {
            setDeletingId('');
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

    const detailRows = useMemo<AttendanceEmployeeReportRow[]>(() => {
        const daysInRange = buildDateRange(fromDate, toDate);
        const totalDays = daysInRange.length;
        const targetEmployees = employeeId === 'all'
            ? employees
            : employees.filter((employee) => employee.id === employeeId);

        return targetEmployees
            .map((employee) => {
                const employeeRecords = records.filter((record) => record.employeeId === employee.id);
                const lateRecords = employeeRecords.filter((record) => record.lateMinutes > 0);
                const onTimeCount = employeeRecords.length - lateRecords.length;
                const totalLateMinutes = lateRecords.reduce((sum, record) => sum + record.lateMinutes, 0);
                const checkInDaySet = new Set(employeeRecords.map((record) => dayKey(record.checkInAt)));
                const missingDays = Math.max(0, totalDays - checkInDaySet.size);
                const leaveDays = employee.status === 'OnLeave' ? missingDays : 0;
                const absentDays = employee.status === 'Active' ? missingDays : 0;

                return {
                    employeeId: employee.id,
                    employeeName: `${employee.firstNameTH} ${employee.lastNameTH}`.trim(),
                    department: employee.department || '-',
                    role: employee.role,
                    employmentStatus: employee.status,
                    checkInCount: employeeRecords.length,
                    onTimeCount,
                    lateCount: lateRecords.length,
                    totalLateMinutes,
                    averageLateMinutes: lateRecords.length > 0 ? Math.round(totalLateMinutes / lateRecords.length) : 0,
                    absentDays,
                    leaveDays,
                    latePenaltyAmount: calculateLatePenalty(lateRecords, config.lateRules),
                };
            })
            .filter((row) => row.employmentStatus !== 'Resigned')
            .sort((a, b) => a.employeeId.localeCompare(b.employeeId));
    }, [config.lateRules, employeeId, employees, fromDate, records, toDate]);

    const detailStats = useMemo(() => {
        return detailRows.reduce(
            (summary, row) => {
                return {
                    employees: summary.employees + 1,
                    absentDays: summary.absentDays + row.absentDays,
                    leaveDays: summary.leaveDays + row.leaveDays,
                    totalLateMinutes: summary.totalLateMinutes + row.totalLateMinutes,
                    totalPenalty: summary.totalPenalty + row.latePenaltyAmount,
                };
            },
            {
                employees: 0,
                absentDays: 0,
                leaveDays: 0,
                totalLateMinutes: 0,
                totalPenalty: 0,
            },
        );
    }, [detailRows]);

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
        }));

        downloadCsv(`attendance_checkins_${fromDate}_${toDate}.csv`, rows);
    };

    const exportDetailCsv = () => {
        const rows = detailRows.map((row) => ({
            employee_id: row.employeeId,
            employee_name: row.employeeName,
            role: row.role,
            department: row.department,
            employment_status: row.employmentStatus,
            checkin_count: row.checkInCount,
            ontime_count: row.onTimeCount,
            late_count: row.lateCount,
            total_late_minutes: row.totalLateMinutes,
            average_late_minutes: row.averageLateMinutes,
            absent_days: row.absentDays,
            leave_days: row.leaveDays,
            late_penalty_amount: row.latePenaltyAmount,
        }));

        downloadCsv(`attendance_detail_${fromDate}_${toDate}.csv`, rows);
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

                <div className="inline-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <div className="panel-muted">
                        Log ทั้งหมด {stats.rows} รายการ · กะที่ไม่ซ้ำ {stats.uniqueShifts} · สาย {stats.lateRows}
                    </div>
                    <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                        <button type="button" className="btn-muted" onClick={exportDetailCsv}>Export รายงานรายชื่อ</button>
                        <button type="button" className="btn-muted" onClick={exportCheckInCsv}>Export Log เช็คอิน</button>
                    </div>
                </div>
                {error ? <div className="form-error">{error}</div> : null}
                {notice ? <p className="panel-muted">{notice}</p> : null}
            </section>

            <section className="panel table-panel">
                <div className="panel-head">
                    <h3>รายงานสรุปรายชื่อ</h3>
                    <span>พนักงาน {detailStats.employees} คน</span>
                </div>

                <p className="panel-muted">
                    ขาดรวม {detailStats.absentDays} วัน · ลารวม {detailStats.leaveDays} วัน · สายรวม {detailStats.totalLateMinutes} นาที · ยอดหักรวม {detailStats.totalPenalty} บาท
                </p>

                {!loading && detailRows.length === 0 ? <p className="panel-muted">ไม่พบข้อมูลพนักงานในช่วงวันที่ที่เลือก</p> : null}

                {!loading && detailRows.length > 0 ? (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>พนักงาน</th>
                                    <th>บทบาท</th>
                                    <th>เช็คอิน</th>
                                    <th>มาสาย</th>
                                    <th>สายรวม (นาที)</th>
                                    <th>ขาด (วัน)</th>
                                    <th>ลา (วัน)</th>
                                    <th>ยอดหักสาย (บาท)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailRows.map((row) => (
                                    <tr key={row.employeeId}>
                                        <td>
                                            <strong>{row.employeeName}</strong>
                                            <div className="panel-muted">{row.employeeId} · {row.department}</div>
                                        </td>
                                        <td>{row.role}</td>
                                        <td>{row.checkInCount} ครั้ง (ตรงเวลา {row.onTimeCount})</td>
                                        <td>{row.lateCount} ครั้ง</td>
                                        <td>{row.totalLateMinutes} (เฉลี่ย {row.averageLateMinutes})</td>
                                        <td>{row.absentDays}</td>
                                        <td>{row.leaveDays}</td>
                                        <td>{row.latePenaltyAmount}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </section>

            <section className="panel table-panel">
                <div className="panel-head">
                    <h3>Log การเช็คอิน</h3>
                </div>

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
                                    <th />
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
                                        <td>
                                            <button
                                                type="button"
                                                className="btn-danger"
                                                onClick={() => void deleteCheckIn(record)}
                                                disabled={deletingId === record.id}
                                            >
                                                {deletingId === record.id ? 'กำลังลบ...' : 'ลบ'}
                                            </button>
                                        </td>
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
