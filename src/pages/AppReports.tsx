import React, { useEffect, useMemo, useState } from 'react';
import { useAppEmployees } from '../context/AppEmployeeContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { appAttendanceService } from '../services/appAttendanceService';
import type { AttendanceEmployeeReportRow, AttendanceSummaryRecord, LatePenaltyRule } from '../types/app';
import { downloadCsv } from '../utils/csv';
import { dayKey } from '../utils/shiftUtils';

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

const getEmployeeLabel = (employeeName: string, employeeId: string): string => {
    const normalized = employeeName.trim();
    return normalized || employeeId;
};

export const AppReports: React.FC = () => {
    const { employees } = useAppEmployees();
    const { config } = useAppSettings();

    const today = new Date().toISOString().slice(0, 10);

    const [records, setRecords] = useState<AttendanceSummaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [employeeId, setEmployeeId] = useState('all');

    const load = async () => {
        setLoading(true);
        setError('');

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
            setError(loadError instanceof Error ? loadError.message : 'Unable to load summary report');
            setRecords([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config.lateGraceMinutes, config.shifts, employees]);

    const recordSummaryByEmployee = useMemo(() => {
        const map = new Map<string, {
            records: AttendanceSummaryRecord[];
            lateRecords: AttendanceSummaryRecord[];
            checkInDaySet: Set<string>;
            totalLateMinutes: number;
        }>();

        records.forEach((record) => {
            const current = map.get(record.employeeId) || {
                records: [],
                lateRecords: [],
                checkInDaySet: new Set<string>(),
                totalLateMinutes: 0,
            };

            current.records.push(record);
            current.checkInDaySet.add(dayKey(record.checkInAt));
            if (record.lateMinutes > 0) {
                current.lateRecords.push(record);
                current.totalLateMinutes += record.lateMinutes;
            }

            map.set(record.employeeId, current);
        });

        return map;
    }, [records]);

    const detailRows = useMemo<AttendanceEmployeeReportRow[]>(() => {
        const daysInRange = buildDateRange(fromDate, toDate);
        const totalDays = daysInRange.length;
        const targetEmployees = employeeId === 'all'
            ? employees
            : employees.filter((employee) => employee.id === employeeId);

        return targetEmployees
            .map((employee) => {
                const summary = recordSummaryByEmployee.get(employee.id);
                const employeeRecords = summary?.records || [];
                const lateRecords = summary?.lateRecords || [];
                const totalLateMinutes = summary?.totalLateMinutes || 0;
                const onTimeCount = employeeRecords.length - lateRecords.length;
                const missingDays = Math.max(0, totalDays - (summary?.checkInDaySet.size || 0));
                const leaveDays = employee.status === 'OnLeave' ? missingDays : 0;
                const absentDays = employee.status === 'Active' ? missingDays : 0;
                const employeeName = [
                    employee.nickname.trim(),
                    `${employee.firstNameTH} ${employee.lastNameTH}`.trim(),
                    `${employee.firstNameEN} ${employee.lastNameEN}`.trim(),
                    employee.id,
                ].find((value) => value && value !== '-') || employee.id;

                return {
                    employeeId: employee.id,
                    employeeName,
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
    }, [config.lateRules, employeeId, employees, fromDate, recordSummaryByEmployee, toDate]);

    const detailStats = useMemo(() => {
        return detailRows.reduce(
            (summary, row) => ({
                employees: summary.employees + 1,
                absentDays: summary.absentDays + row.absentDays,
                leaveDays: summary.leaveDays + row.leaveDays,
                totalLateMinutes: summary.totalLateMinutes + row.totalLateMinutes,
                totalPenalty: summary.totalPenalty + row.latePenaltyAmount,
            }),
            {
                employees: 0,
                absentDays: 0,
                leaveDays: 0,
                totalLateMinutes: 0,
                totalPenalty: 0,
            },
        );
    }, [detailRows]);

    const exportSummaryCsv = () => {
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

        downloadCsv(`attendance_summary_${fromDate}_${toDate}.csv`, rows);
    };

    return (
        <div className="portal-grid reveal-up">
            <section className="panel">
                <div className="panel-head">
                    <h3>Summary Report Filters</h3>
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
                        Default range is today. Employees {detailStats.employees} | absent {detailStats.absentDays} | leave {detailStats.leaveDays}
                    </div>
                    <button type="button" className="btn-muted" onClick={exportSummaryCsv}>Export Summary CSV</button>
                </div>

                {error ? <div className="form-error">{error}</div> : null}
            </section>

            <section className="panel table-panel">
                <div className="panel-head">
                    <h3>Attendance Summary</h3>
                    <span>{detailRows.length} employees</span>
                </div>

                <p className="panel-muted">
                    Total absent {detailStats.absentDays} day(s) | total leave {detailStats.leaveDays} day(s) | total late {detailStats.totalLateMinutes} min | total penalty {detailStats.totalPenalty} THB
                </p>

                {loading ? <p className="panel-muted">Loading summary report...</p> : null}

                {!loading && detailRows.length === 0 ? (
                    <p className="panel-muted">No summary data found for the selected range.</p>
                ) : null}

                {!loading && detailRows.length > 0 ? (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Role</th>
                                    <th>Check-ins</th>
                                    <th>Late Count</th>
                                    <th>Total Late</th>
                                    <th>Absent</th>
                                    <th>Leave</th>
                                    <th>Penalty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailRows.map((row) => (
                                    <tr key={row.employeeId}>
                                        <td>
                                            <strong>{getEmployeeLabel(row.employeeName, row.employeeId)}</strong>
                                            <div className="panel-muted">{row.employeeId} | {row.department}</div>
                                        </td>
                                        <td>{row.role}</td>
                                        <td>{row.checkInCount} (On time {row.onTimeCount})</td>
                                        <td>{row.lateCount}</td>
                                        <td>{row.totalLateMinutes} (avg {row.averageLateMinutes})</td>
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
        </div>
    );
};
