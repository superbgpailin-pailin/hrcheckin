import React, { useEffect, useMemo, useState } from 'react';
import { MetricCard } from '../components/MetricCard';
import { useAppEmployees } from '../context/AppEmployeeContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { appAttendanceService } from '../services/appAttendanceService';
import type { AttendanceSummaryRecord, ShiftDefinition } from '../types/app';

type DashboardFilterMode = 'daily' | 'monthly' | 'custom';

const todayBangkokDateInput = (): string => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

const todayBangkokMonthInput = (): string => {
    return todayBangkokDateInput().slice(0, 7);
};

const dateInputToUtcDate = (dateInput: string): Date => {
    return new Date(`${dateInput}T00:00:00Z`);
};

const endOfMonthInput = (monthInput: string): string => {
    const [yearRaw, monthRaw] = monthInput.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return todayBangkokDateInput();
    }

    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
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

const dayKeyBangkok = (iso: string): string => {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

const shortDateLabel = (dateInput: string): string => {
    const [yearRaw, monthRaw, dayRaw] = dateInput.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return dateInput;
    }

    return `${day}/${month}`;
};

const monthLabel = (monthInput: string): string => {
    const [yearRaw, monthRaw] = monthInput.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);

    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return monthInput;
    }

    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
};

const rangeLabel = (mode: DashboardFilterMode, from: string, to: string, monthInput: string): string => {
    if (mode === 'daily') {
        return `Date ${shortDateLabel(from)}`;
    }
    if (mode === 'monthly') {
        return monthLabel(monthInput);
    }
    return `${shortDateLabel(from)} - ${shortDateLabel(to)}`;
};

const eligibleEmployeesForShift = (
    shift: ShiftDefinition,
    activeEmployees: Array<{ role: 'Employee' | 'Supervisor' }>,
): number => {
    if (!shift.supervisorOnly) {
        return activeEmployees.length;
    }

    return activeEmployees.filter((employee) => employee.role === 'Supervisor').length;
};

export const AppDashboard: React.FC = () => {
    const { employees } = useAppEmployees();
    const { config } = useAppSettings();

    const today = todayBangkokDateInput();
    const [filterMode, setFilterMode] = useState<DashboardFilterMode>('daily');
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedMonth, setSelectedMonth] = useState(todayBangkokMonthInput);
    const [customFromDate, setCustomFromDate] = useState(today);
    const [customToDate, setCustomToDate] = useState(today);
    const [refreshNonce, setRefreshNonce] = useState(0);

    const [rangeRecords, setRangeRecords] = useState<AttendanceSummaryRecord[]>([]);
    const [shiftFocusRecords, setShiftFocusRecords] = useState<AttendanceSummaryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const activeEmployees = useMemo(() => {
        return employees.filter((employee) => employee.status === 'Active');
    }, [employees]);

    const activeEmployeeIds = useMemo(() => {
        return new Set(activeEmployees.map((employee) => employee.id));
    }, [activeEmployees]);

    const selectedRange = useMemo(() => {
        if (filterMode === 'monthly') {
            return {
                from: `${selectedMonth}-01`,
                to: endOfMonthInput(selectedMonth),
            };
        }

        if (filterMode === 'custom') {
            return {
                from: customFromDate,
                to: customToDate,
            };
        }

        return {
            from: selectedDate,
            to: selectedDate,
        };
    }, [customFromDate, customToDate, filterMode, selectedDate, selectedMonth]);

    const shiftFocusDate = useMemo(() => {
        return filterMode === 'daily' ? selectedRange.from : today;
    }, [filterMode, selectedRange.from, today]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');

            try {
                const shiftFocusPromise = appAttendanceService.listCheckIns(
                    config.shifts,
                    employees,
                    config.lateGraceMinutes,
                    { from: shiftFocusDate, to: shiftFocusDate },
                );

                if (!selectedRange.from || !selectedRange.to || selectedRange.from > selectedRange.to) {
                    const shiftFocusResult = await shiftFocusPromise;
                    setShiftFocusRecords(shiftFocusResult);
                    setRangeRecords([]);
                    setError('Please choose a valid date range.');
                    return;
                }

                const [rangeResult, shiftFocusResult] = await Promise.all([
                    appAttendanceService.listCheckIns(
                        config.shifts,
                        employees,
                        config.lateGraceMinutes,
                        {
                            from: selectedRange.from,
                            to: selectedRange.to,
                        },
                    ),
                    shiftFocusPromise,
                ]);

                setRangeRecords(rangeResult);
                setShiftFocusRecords(shiftFocusResult);
            } catch (loadError) {
                setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard');
                setRangeRecords([]);
                setShiftFocusRecords([]);
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [config.lateGraceMinutes, config.shifts, employees, refreshNonce, selectedRange.from, selectedRange.to, shiftFocusDate]);

    const rangeDays = useMemo(() => {
        return buildDateRange(selectedRange.from, selectedRange.to);
    }, [selectedRange.from, selectedRange.to]);

    const stats = useMemo(() => {
        const filteredRecords = rangeRecords.filter((record) => activeEmployeeIds.has(record.employeeId));
        const uniqueCheckedInEmployees = new Set(filteredRecords.map((record) => record.employeeId));
        const lateRows = filteredRecords.filter((record) => record.status === 'Late');
        const lateEmployees = new Set(lateRows.map((record) => record.employeeId));
        const absentValue = Math.max(0, activeEmployees.length - uniqueCheckedInEmployees.size);

        return {
            activeEmployees: activeEmployees.length,
            checkedInEmployees: uniqueCheckedInEmployees.size,
            lateCount: lateEmployees.size,
            absentValue,
            avgLateMinutes: lateRows.length > 0
                ? Math.round(lateRows.reduce((sum, record) => sum + record.lateMinutes, 0) / lateRows.length)
                : 0,
        };
    }, [activeEmployeeIds, activeEmployees.length, rangeRecords]);

    const trend = useMemo(() => {
        return rangeDays.map((dateInput) => {
            const dayRecords = rangeRecords.filter((record) => dayKeyBangkok(record.checkInAt) === dateInput && activeEmployeeIds.has(record.employeeId));
            return {
                label: shortDateLabel(dateInput),
                value: new Set(dayRecords.map((record) => record.employeeId)).size,
            };
        });
    }, [activeEmployeeIds, rangeDays, rangeRecords]);

    const maxTrend = Math.max(1, ...trend.map((item) => item.value));

    const shiftStatsToday = useMemo(() => {
        return config.shifts.map((shift, index) => {
            const shiftRecords = shiftFocusRecords.filter((record) => record.shiftId === shift.id && activeEmployeeIds.has(record.employeeId));
            const checkedIn = new Set(shiftRecords.map((record) => record.employeeId));
            const late = new Set(
                shiftRecords
                    .filter((record) => record.status === 'Late')
                    .map((record) => record.employeeId),
            );
            const eligibleEmployees = eligibleEmployeesForShift(shift, activeEmployees);

            return {
                key: shift.id,
                label: shift.label,
                checkedIn: checkedIn.size,
                late: late.size,
                absent: Math.max(0, eligibleEmployees - checkedIn.size),
                shiftWindow: `${shift.start}-${shift.end}`,
                accentClass: `shift-accent-${(index % 4) + 1}`,
            };
        });
    }, [activeEmployeeIds, activeEmployees, config.shifts, shiftFocusRecords]);

    const shiftSummaryLabel = filterMode === 'daily' ? shortDateLabel(shiftFocusDate) : 'Today';

    const selectedRangeLabel = rangeLabel(filterMode, selectedRange.from, selectedRange.to, selectedMonth);

    return (
        <div className="portal-grid reveal-up">
            <section className="panel">
                <div className="panel-head">
                    <h3>Dashboard Filters</h3>
                    <button type="button" className="btn-primary" onClick={() => setRefreshNonce((current) => current + 1)}>
                        Refresh
                    </button>
                </div>

                <div className="settings-subnav">
                    <button
                        type="button"
                        className={`settings-subnav-btn ${filterMode === 'daily' ? 'active' : ''}`}
                        onClick={() => setFilterMode('daily')}
                    >
                        Daily
                    </button>
                    <button
                        type="button"
                        className={`settings-subnav-btn ${filterMode === 'monthly' ? 'active' : ''}`}
                        onClick={() => setFilterMode('monthly')}
                    >
                        Monthly
                    </button>
                    <button
                        type="button"
                        className={`settings-subnav-btn ${filterMode === 'custom' ? 'active' : ''}`}
                        onClick={() => setFilterMode('custom')}
                    >
                        Custom Range
                    </button>
                </div>

                <div className="dashboard-filter-grid" style={{ marginTop: '0.9rem' }}>
                    {filterMode === 'daily' ? (
                        <div>
                            <label>Date</label>
                            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                        </div>
                    ) : null}

                    {filterMode === 'monthly' ? (
                        <div>
                            <label>Month</label>
                            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
                        </div>
                    ) : null}

                    {filterMode === 'custom' ? (
                        <>
                            <div>
                                <label>From</label>
                                <input type="date" value={customFromDate} onChange={(event) => setCustomFromDate(event.target.value)} />
                            </div>
                            <div>
                                <label>To</label>
                                <input type="date" value={customToDate} onChange={(event) => setCustomToDate(event.target.value)} />
                            </div>
                        </>
                    ) : null}
                </div>

                <p className="panel-muted">Selected range: {selectedRangeLabel}</p>
                {error ? <div className="form-error">{error}</div> : null}
            </section>

            <section className="metric-grid">
                <MetricCard icon="EMP" label="Active Employees" value={stats.activeEmployees} tone="blue" />
                <MetricCard icon="IN" label="Checked In" value={stats.checkedInEmployees} tone="green" />
                <MetricCard icon="LT" label="Late" value={stats.lateCount} tone="amber" />
                <MetricCard icon="OUT" label="Not Checked In" value={stats.absentValue} tone="rose" />
            </section>

            <section className="shift-summary-grid">
                {shiftStatsToday.map((shift) => (
                    <article key={shift.key} className={`shift-summary-card ${shift.accentClass}`}>
                        <div className="shift-summary-head">
                            <div>
                                <h3>{shift.label}</h3>
                                <p>{shift.shiftWindow}</p>
                            </div>
                            <span>{shiftSummaryLabel}</span>
                        </div>

                        <div className="shift-summary-stats">
                            <div className="shift-summary-stat">
                                <span>Checked In</span>
                                <strong>{shift.checkedIn}</strong>
                            </div>
                            <div className="shift-summary-stat">
                                <span>Not Checked In</span>
                                <strong>{shift.absent}</strong>
                            </div>
                            <div className="shift-summary-stat">
                                <span>Late</span>
                                <strong>{shift.late}</strong>
                            </div>
                        </div>
                    </article>
                ))}
            </section>

            <section className="panel chart-panel">
                <div className="panel-head">
                    <h3>Check-in Trend</h3>
                    <span>{loading ? 'Loading...' : selectedRangeLabel}</span>
                </div>

                {loading ? <p className="panel-muted">Loading dashboard...</p> : null}

                {!loading ? (
                    <div className="bars-scroll">
                        <div className="bars" style={{ gridTemplateColumns: `repeat(${Math.max(trend.length, 1)}, minmax(56px, 1fr))` }}>
                            {trend.map((item) => (
                                <div className="bar-item" key={item.label}>
                                    <div className="bar-track">
                                        <div
                                            className="bar-fill"
                                            style={{ height: `${Math.round((item.value / maxTrend) * 100)}%` }}
                                        />
                                    </div>
                                    <span>{item.label}</span>
                                    <strong>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
            </section>

            <section className="panel">
                <div className="panel-head">
                    <h3>Average Late Minutes</h3>
                    <span>{selectedRangeLabel}</span>
                </div>
                <div className="hero-number">{stats.avgLateMinutes} min</div>
                <p className="panel-muted">Using late grace from Settings: {config.lateGraceMinutes} min</p>
            </section>
        </div>
    );
};
