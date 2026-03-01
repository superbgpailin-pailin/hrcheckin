import React, { useEffect, useMemo, useState } from 'react';
import { useAppEmployees } from '../context/AppEmployeeContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { appAttendanceService } from '../services/appAttendanceService';
import type { AttendanceEmployeeReportRow, AttendanceSummaryRecord, LatePenaltyRule } from '../types/app';
import { downloadCsv } from '../utils/csv';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const todayBangkokDateInput = (): string => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

const dayKeyBangkok = (iso: string): string => {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

const timeLabelBangkok = (iso: string): string => {
    return new Date(iso).toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
    });
};

const dateInputToUtcDate = (dateInput: string): Date => {
    return new Date(`${dateInput}T00:00:00Z`);
};

const buildDateRange = (from: string, to: string): string[] => {
    if (!from || !to || from > to) {
        return [];
    }

    const result: string[] = [];
    const cursor = dateInputToUtcDate(from);
    const end = dateInputToUtcDate(to);

    while (cursor.getTime() <= end.getTime()) {
        result.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return result;
};

const monthFromIso = (iso: string): string => {
    return dayKeyBangkok(iso).slice(0, 7);
};

const monthLabel = (monthKey: string): string => {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);

    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return monthKey;
    }

    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('th-TH', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
};

const endOfMonthInput = (monthKey: string): string => {
    const [yearRaw, monthRaw] = monthKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);

    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return monthKey;
    }

    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
};

const weekdayIndex = (dateInput: string): number => {
    return dateInputToUtcDate(dateInput).getUTCDay();
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

const buildCalendarMonths = (
    fromDate: string,
    toDate: string,
    recordsByDay: Map<string, AttendanceSummaryRecord>,
): Array<{
    key: string;
    label: string;
    cells: Array<{ dateInput: string; inRange: boolean; record: AttendanceSummaryRecord | null } | null>;
}> => {
    if (!fromDate || !toDate || fromDate > toDate) {
        return [];
    }

    const allDates = buildDateRange(fromDate, toDate);
    const monthKeys = Array.from(new Set(allDates.map((dateInput) => dateInput.slice(0, 7))));

    return monthKeys.map((monthKey) => {
        const monthStart = `${monthKey}-01`;
        const monthEnd = endOfMonthInput(monthKey);
        const monthDates = buildDateRange(monthStart, monthEnd);
        const cells: Array<{ dateInput: string; inRange: boolean; record: AttendanceSummaryRecord | null } | null> = [];

        for (let index = 0; index < weekdayIndex(monthStart); index += 1) {
            cells.push(null);
        }

        monthDates.forEach((dateInput) => {
            const inRange = dateInput >= fromDate && dateInput <= toDate;
            cells.push({
                dateInput,
                inRange,
                record: inRange ? recordsByDay.get(dateInput) || null : null,
            });
        });

        while (cells.length % 7 !== 0) {
            cells.push(null);
        }

        return {
            key: monthKey,
            label: monthLabel(monthKey),
            cells,
        };
    });
};

export const AppReports: React.FC = () => {
    const { employees } = useAppEmployees();
    const { config } = useAppSettings();

    const today = todayBangkokDateInput();
    const currentMonth = today.slice(0, 7);
    const calendarFromDate = `${currentMonth}-01`;
    const calendarToDate = endOfMonthInput(currentMonth);

    const [records, setRecords] = useState<AttendanceSummaryRecord[]>([]);
    const [calendarRecords, setCalendarRecords] = useState<AttendanceSummaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const [error, setError] = useState('');
    const [calendarError, setCalendarError] = useState('');
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [employeeId, setEmployeeId] = useState('all');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

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
    }, [config.lateGraceMinutes, config.shifts, employees, fromDate, toDate, employeeId]);

    useEffect(() => {
        if (!selectedEmployeeId) {
            setCalendarRecords([]);
            setCalendarError('');
            setCalendarLoading(false);
            return;
        }

        let cancelled = false;

        const loadCalendar = async () => {
            setCalendarLoading(true);
            setCalendarError('');

            try {
                const result = await appAttendanceService.listCheckIns(
                    config.shifts,
                    employees,
                    config.lateGraceMinutes,
                    {
                        from: calendarFromDate,
                        to: calendarToDate,
                        employeeId: selectedEmployeeId,
                    },
                );

                if (!cancelled) {
                    setCalendarRecords(result);
                }
            } catch (loadError) {
                if (!cancelled) {
                    setCalendarError(loadError instanceof Error ? loadError.message : 'Unable to load attendance calendar');
                    setCalendarRecords([]);
                }
            } finally {
                if (!cancelled) {
                    setCalendarLoading(false);
                }
            }
        };

        void loadCalendar();

        return () => {
            cancelled = true;
        };
    }, [calendarFromDate, calendarToDate, config.lateGraceMinutes, config.shifts, employees, selectedEmployeeId]);

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
            current.checkInDaySet.add(dayKeyBangkok(record.checkInAt));
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

    useEffect(() => {
        if (detailRows.length === 0) {
            setSelectedEmployeeId('');
            return;
        }

        const selectedStillExists = detailRows.some((row) => row.employeeId === selectedEmployeeId);
        if (!selectedStillExists) {
            setSelectedEmployeeId('');
        }
    }, [detailRows, selectedEmployeeId]);

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

    const selectedEmployeeRecordsByDay = useMemo(() => {
        const map = new Map<string, AttendanceSummaryRecord>();
        const items = [...calendarRecords].sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());

        items.forEach((record) => {
            const key = dayKeyBangkok(record.checkInAt);
            if (!map.has(key)) {
                map.set(key, record);
            }
        });

        return map;
    }, [calendarRecords]);

    const calendarMonths = useMemo(() => {
        if (!selectedEmployeeId) {
            return [];
        }

        return buildCalendarMonths(calendarFromDate, calendarToDate, selectedEmployeeRecordsByDay);
    }, [calendarFromDate, calendarToDate, selectedEmployeeId, selectedEmployeeRecordsByDay]);

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
                                {detailRows.map((row) => {
                                    const isExpanded = selectedEmployeeId === row.employeeId;

                                    return (
                                        <React.Fragment key={row.employeeId}>
                                            <tr
                                                className={`report-select-row ${isExpanded ? 'active' : ''}`}
                                                onClick={() => setSelectedEmployeeId((current) => current === row.employeeId ? '' : row.employeeId)}
                                            >
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

                                            {isExpanded ? (
                                                <tr className="report-detail-row">
                                                    <td colSpan={8}>
                                                        <div className="report-detail-card">
                                                            <div className="calendar-month-head">
                                                                <h4>
                                                                    {`${row.employeeId} | ${getEmployeeLabel(row.employeeName, row.employeeId)} | ${monthLabel(currentMonth)}`}
                                                                </h4>
                                                                <span>Attendance Calendar</span>
                                                            </div>

                                                            {calendarLoading ? (
                                                                <p className="panel-muted">Loading attendance calendar...</p>
                                                            ) : null}

                                                            {calendarError ? (
                                                                <div className="form-error">{calendarError}</div>
                                                            ) : null}

                                                            {!calendarLoading && !calendarError ? (
                                                                <div className="calendar-months">
                                                                    {calendarMonths.map((month) => (
                                                                        <article key={month.key} className="calendar-month-card">
                                                                            <div className="calendar-month-head">
                                                                                <h4>{month.label}</h4>
                                                                                <span>{row.employeeId}</span>
                                                                            </div>

                                                                            <div className="calendar-grid calendar-weekdays">
                                                                                {WEEKDAY_LABELS.map((label) => (
                                                                                    <div key={label} className="calendar-weekday">{label}</div>
                                                                                ))}
                                                                            </div>

                                                                            <div className="calendar-grid">
                                                                                {month.cells.map((cell, index) => {
                                                                                    if (!cell) {
                                                                                        return <div key={`${month.key}-empty-${index}`} className="calendar-day calendar-day-empty-slot" />;
                                                                                    }

                                                                                    const dayNumber = Number(cell.dateInput.slice(-2));
                                                                                    const toneClass = !cell.inRange
                                                                                        ? 'out-range'
                                                                                        : cell.record
                                                                                            ? (cell.record.status === 'Late' ? 'late' : 'on-time')
                                                                                            : 'missing';

                                                                                    return (
                                                                                        <div key={cell.dateInput} className={`calendar-day ${toneClass}`}>
                                                                                            <div className="calendar-day-label">{dayNumber}</div>

                                                                                            {cell.inRange ? (
                                                                                                cell.record ? (
                                                                                                    <>
                                                                                                        <strong className="calendar-day-time">{timeLabelBangkok(cell.record.checkInAt)}</strong>
                                                                                                        <span className="calendar-day-shift">{cell.record.shiftLabel}</span>
                                                                                                        {cell.record.lateMinutes > 0 ? (
                                                                                                            <span className="panel-muted">Late {cell.record.lateMinutes} min</span>
                                                                                                        ) : null}
                                                                                                        <span className={`status-pill ${cell.record.status === 'Late' ? 'late' : 'on-time'}`}>
                                                                                                            {cell.record.status}
                                                                                                        </span>
                                                                                                    </>
                                                                                                ) : (
                                                                                                    <span className="calendar-day-empty">No check-in</span>
                                                                                                )
                                                                                            ) : null}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </article>
                                                                    ))}
                                                                </div>
                                                            ) : null}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </section>
        </div>
    );
};
