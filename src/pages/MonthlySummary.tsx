import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useEmployee } from '../context/EmployeeContext';
import { useSettings } from '../context/SettingsContext';
import { useHoliday } from '../context/HolidayContext';
import { MOCK_ATTENDANCE } from '../data/mockData';

export const MonthlySummary: React.FC = () => {
    const { language } = useLanguage();
    const { employees } = useEmployee();
    const { config } = useSettings();
    const { selectedHolidays } = useHoliday();

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');

    // Parse month
    const [year, month] = selectedMonth.split('-').map(Number);

    // Get attendance for the month
    const getEmployeeSummary = (empId: string) => {
        const empAttendance = MOCK_ATTENDANCE.filter(a => {
            const d = new Date(a.date);
            return a.employeeId === empId && d.getFullYear() === year && d.getMonth() + 1 === month;
        });

        const empHolidays = selectedHolidays.filter(h => {
            const d = new Date(h.date);
            return h.employeeId === empId && d.getFullYear() === year && d.getMonth() + 1 === month;
        });

        // Calculate stats
        let workDays = 0;
        let lateDays = 0;
        let otDays = 0;
        let holidayDays = empHolidays.length;
        let absentDays = 0;
        let totalPenalty = 0;

        // Late thresholds from config
        const latenessRules = config.latenessRules || [
            { minutes: 15, amount: 50 },
            { minutes: 30, amount: 100 }
        ];

        const lateByThreshold: { [key: string]: number } = {};
        latenessRules.forEach(rule => {
            lateByThreshold[`>${rule.minutes}min`] = 0;
        });

        empAttendance.forEach(att => {
            const checkInTime = att.checkInTime;
            const holidayOnDay = empHolidays.find(h => h.date === att.date);

            if (holidayOnDay) {
                // Check-in on holiday = OT
                otDays++;
            } else {
                workDays++;

                // Check if late
                if (att.status === 'Late') {
                    lateDays++;

                    // Parse check-in time to calculate minutes late
                    const [h, m] = checkInTime.split(':').map(Number);
                    const checkInMinutes = h * 60 + m;
                    const shiftStart = 8 * 60; // 08:00 default
                    const minutesLate = checkInMinutes - shiftStart;

                    // Apply penalty based on rules
                    for (const rule of latenessRules.sort((a, b) => b.minutes - a.minutes)) {
                        if (minutesLate >= rule.minutes) {
                            totalPenalty += rule.amount;
                            lateByThreshold[`>${rule.minutes}min`] = (lateByThreshold[`>${rule.minutes}min`] || 0) + 1;
                            break;
                        }
                    }
                }
            }
        });

        // Calculate absences (weekdays - workDays - holidays - OT)
        // Simplified: assume 22 working days per month
        const expectedWorkDays = 22;
        absentDays = Math.max(0, expectedWorkDays - workDays - holidayDays);

        return {
            workDays,
            holidayDays,
            absentDays,
            lateDays,
            otDays,
            totalPenalty,
            lateByThreshold
        };
    };

    // Get employees to display
    const displayEmployees = selectedEmployeeId === 'all'
        ? employees.filter(e => e.status === 'Active')
        : employees.filter(e => e.id === selectedEmployeeId);

    const getEmployeeName = (emp: any) => {
        return language === 'th' ? `${emp.firstNameTH} ${emp.lastNameTH}` : `${emp.firstNameEN} ${emp.lastNameEN}`;
    };

    return (
        <div className="page-container">
            <h1 className="page-title">
                📊 {language === 'th' ? 'สรุปรายเดือน' : 'Monthly Summary'}
            </h1>

            {/* Filters */}
            <div className="clean-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                    />

                    <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', minWidth: '200px' }}
                    >
                        <option value="all">{language === 'th' ? '👤 พนักงานทั้งหมด' : '👤 All Employees'}</option>
                        {employees.filter(e => e.status === 'Active').map(emp => (
                            <option key={emp.id} value={emp.id}>
                                {getEmployeeName(emp)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Summary Table */}
            <div className="clean-card" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f9fafb' }}>
                        <tr>
                            <th style={{ padding: '1rem', textAlign: 'left', color: '#374151' }}>{language === 'th' ? 'พนักงาน' : 'Employee'}</th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: '#374151' }}>{language === 'th' ? 'ทำงาน' : 'Work'}</th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: '#374151' }}>{language === 'th' ? 'หยุด' : 'Holiday'}</th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: '#374151' }}>{language === 'th' ? 'ขาด' : 'Absent'}</th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: '#374151' }}>{language === 'th' ? 'สาย' : 'Late'}</th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: '#374151' }}>OT</th>
                            <th style={{ padding: '1rem', textAlign: 'center', color: '#374151' }}>{language === 'th' ? 'ค่าปรับ' : 'Penalty'}</th>
                            <th style={{ padding: '1rem', textAlign: 'left', color: '#374151' }}>{language === 'th' ? 'รายละเอียดสาย' : 'Late Details'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayEmployees.map(emp => {
                            const summary = getEmployeeSummary(emp.id);
                            return (
                                <tr key={emp.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <img src={emp.photoUrl || 'https://ui-avatars.com/api/?background=random'} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{getEmployeeName(emp)}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{emp.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontWeight: 600 }}>
                                            {summary.workDays}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontWeight: 600 }}>
                                            {summary.holidayDays}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <span style={{ background: summary.absentDays > 0 ? '#fee2e2' : '#f3f4f6', color: summary.absentDays > 0 ? '#dc2626' : '#6b7280', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontWeight: 600 }}>
                                            {summary.absentDays}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <span style={{ background: summary.lateDays > 0 ? '#fef3c7' : '#f3f4f6', color: summary.lateDays > 0 ? '#d97706' : '#6b7280', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontWeight: 600 }}>
                                            {summary.lateDays}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <span style={{ background: summary.otDays > 0 ? '#fae8ff' : '#f3f4f6', color: summary.otDays > 0 ? '#a855f7' : '#6b7280', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontWeight: 600 }}>
                                            {summary.otDays}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <span style={{ color: summary.totalPenalty > 0 ? '#dc2626' : '#6b7280', fontWeight: 700 }}>
                                            ฿{summary.totalPenalty.toLocaleString()}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                        {Object.entries(summary.lateByThreshold)
                                            .filter(([_, count]) => count > 0)
                                            .map(([threshold, count]) => `${threshold}: ${count}`)
                                            .join(', ') || '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#6b7280' }}>
                <div>🟢 {language === 'th' ? 'ทำงาน = วันที่เช็คอิน (ไม่ใช่วันหยุด)' : 'Work = Check-in days (non-holiday)'}</div>
                <div>🟣 OT = {language === 'th' ? 'เช็คอินในวันหยุด' : 'Check-in on holiday'}</div>
                <div>🟡 {language === 'th' ? 'สาย = ตามการตั้งค่า' : 'Late = Per settings'}</div>
            </div>
        </div>
    );
};
