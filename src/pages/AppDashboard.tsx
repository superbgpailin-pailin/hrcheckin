import React, { useEffect, useMemo, useState } from 'react';
import { MetricCard } from '../components/MetricCard';
import { useAppEmployees } from '../context/AppEmployeeContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { appAttendanceService } from '../services/appAttendanceService';
import type { AttendanceSummaryRecord } from '../types/app';
import { dayKey } from '../utils/shiftUtils';

export const AppDashboard: React.FC = () => {
    const { employees } = useAppEmployees();
    const { config } = useAppSettings();
    const [records, setRecords] = useState<AttendanceSummaryRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const today = new Date();
            const from = new Date(today);
            from.setDate(today.getDate() - 6);
            const result = await appAttendanceService.listCheckIns(
                config.shifts,
                employees,
                config.lateGraceMinutes,
                {
                    from: from.toISOString().slice(0, 10),
                    to: today.toISOString().slice(0, 10),
                },
            );
            setRecords(result);
            setLoading(false);
        };

        void load();
    }, [config.lateGraceMinutes, config.shifts, employees]);

    const stats = useMemo(() => {
        const today = new Date().toISOString().slice(0, 10);
        const activeEmployees = employees.filter((employee) => employee.status === 'Active');
        const todayRecords = records.filter((record) => record.checkInAt.slice(0, 10) === today);
        const uniqueToday = new Set(todayRecords.map((record) => record.employeeId));
        const lateToday = new Set(todayRecords.filter((record) => record.status === 'Late').map((record) => record.employeeId));

        return {
            activeEmployees: activeEmployees.length,
            checkedInToday: uniqueToday.size,
            lateToday: lateToday.size,
            absentToday: Math.max(0, activeEmployees.length - uniqueToday.size),
            avgLateMinutes: lateToday.size === 0
                ? 0
                : Math.round(todayRecords.reduce((sum, record) => sum + record.lateMinutes, 0) / lateToday.size),
        };
    }, [employees, records]);

    const trend = useMemo(() => {
        const days = Array.from({ length: 7 }, (_, index) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - index));
            return d;
        });

        return days.map((date) => {
            const key = date.toISOString().slice(0, 10);
            const unique = new Set(
                records
                    .filter((record) => dayKey(record.checkInAt) === key)
                    .map((record) => record.employeeId),
            );

            return {
                label: `${date.getDate()}/${date.getMonth() + 1}`,
                value: unique.size,
            };
        });
    }, [records]);

    const maxTrend = Math.max(1, ...trend.map((item) => item.value));

    return (
        <div className="portal-grid reveal-up">
            <section className="metric-grid">
                <MetricCard icon="👥" label="พนักงาน Active" value={stats.activeEmployees} tone="blue" />
                <MetricCard icon="✅" label="เช็คอินวันนี้" value={stats.checkedInToday} tone="green" />
                <MetricCard icon="⏰" label="สายวันนี้" value={stats.lateToday} tone="amber" />
                <MetricCard icon="📌" label="ขาดวันนี้" value={stats.absentToday} tone="rose" />
            </section>

            <section className="panel chart-panel">
                <div className="panel-head">
                    <h3>แนวโน้มการเช็คอิน 7 วันล่าสุด</h3>
                    <span>{loading ? 'กำลังโหลด...' : 'อัปเดตล่าสุด'}</span>
                </div>
                <div className="bars">
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
            </section>

            <section className="panel">
                <div className="panel-head">
                    <h3>ค่าเฉลี่ยความสาย (วันนี้)</h3>
                </div>
                <div className="hero-number">{stats.avgLateMinutes} นาที</div>
                <p className="panel-muted">ใช้ค่าเกณฑ์สายจาก Settings: {config.lateGraceMinutes} นาที</p>
            </section>
        </div>
    );
};
