import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { useEmployee } from '../context/EmployeeContext';
import { MOCK_ATTENDANCE } from '../data/mockData';

export const AdminAttendance: React.FC = () => {
    const { language } = useLanguage();
    const t = getTranslation(language);
    const { employees } = useEmployee();

    const [viewMode, setViewMode] = useState<'daily' | 'calendar'>('daily');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
    const [selectedShift, setSelectedShift] = useState<string>('all');
    const [selectedSite, setSelectedSite] = useState<string>('all');

    // Employee Calendar Popup
    const [popupEmployee, setPopupEmployee] = useState<string | null>(null);

    // Get unique shifts and sites from data
    const allShifts = [...new Set(MOCK_ATTENDANCE.map(r => r.shift))];
    const allSites = [...new Set(MOCK_ATTENDANCE.map(r => r.site))];

    // Merge attendance with employee data
    const attendanceRecords = MOCK_ATTENDANCE.map(record => {
        const emp = employees.find(e => e.id === record.employeeId);
        return {
            ...record,
            empName: emp ? (language === 'th' ? `${emp.firstNameTH} ${emp.lastNameTH}` : `${emp.firstNameEN} ${emp.lastNameEN}`) : record.employeeId,
            photoUrl: emp?.photoUrl
        };
    });

    // Filter by Date, Employee, Shift, Site
    const filteredRecords = attendanceRecords.filter((r: any) => {
        const dateMatch = r.date === selectedDate;
        const empMatch = selectedEmployeeId === 'all' || r.employeeId === selectedEmployeeId;
        const shiftMatch = selectedShift === 'all' || r.shift === selectedShift;
        const siteMatch = selectedSite === 'all' || r.site === selectedSite;
        return dateMatch && empMatch && shiftMatch && siteMatch;
    });

    const presentCount = attendanceRecords.filter((r: any) => r.date === selectedDate).length;
    const totalEmployees = employees.filter(e => e.status === 'Active').length;
    const absentCount = totalEmployees - presentCount;

    // Date navigation
    const changeDate = (days: number) => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() + days);
        setSelectedDate(current.toISOString().split('T')[0]);
    };

    // Calendar generation for popup
    const generateCalendarForEmployee = (empId: string) => {
        const today = new Date(selectedDate);
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);

        // Get records for this employee in this month
        const empRecords = attendanceRecords.filter((r: any) => {
            const d = new Date(r.date);
            return r.employeeId === empId && d.getMonth() === month && d.getFullYear() === year;
        });

        return { days, empRecords, year, month };
    };

    // Get employee info for popup
    const getPopupEmployeeInfo = () => {
        if (!popupEmployee) return null;
        const emp = employees.find(e => e.id === popupEmployee);
        return emp;
    };

    const commonT = t.common as any;

    return (
        <div className="page-container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 className="page-title" style={{ margin: 0 }}>{t.menu.timeAttendance}</h1>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-color)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button
                        onClick={() => setViewMode('daily')}
                        style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: viewMode === 'daily' ? 'var(--primary-color)' : 'transparent', color: viewMode === 'daily' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}
                    >
                        {commonT.list || 'List'}
                    </button>
                    <button
                        onClick={() => setViewMode('calendar')}
                        style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', background: viewMode === 'calendar' ? 'var(--primary-color)' : 'transparent', color: viewMode === 'calendar' ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}
                    >
                        {commonT.calendar || 'Calendar'}
                    </button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="clean-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Date Filter with Prev/Next */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                            onClick={() => changeDate(-1)}
                            style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer', fontWeight: 600 }}
                        >
                            ◀
                        </button>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', minWidth: '150px' }}
                        />
                        <button
                            onClick={() => changeDate(1)}
                            style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer', fontWeight: 600 }}
                        >
                            ▶
                        </button>
                    </div>

                    {/* Employee Filter */}
                    <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', minWidth: '180px' }}
                    >
                        <option value="all">{language === 'th' ? '👤 พนักงานทั้งหมด' : '👤 All Employees'}</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                                {language === 'th' ? `${emp.firstNameTH} ${emp.lastNameTH}` : `${emp.firstNameEN} ${emp.lastNameEN}`}
                            </option>
                        ))}
                    </select>

                    {/* Shift Filter */}
                    <select
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', minWidth: '150px' }}
                    >
                        <option value="all">{language === 'th' ? '⏰ กะทั้งหมด' : '⏰ All Shifts'}</option>
                        {allShifts.map(shift => (
                            <option key={shift} value={shift}>{shift}</option>
                        ))}
                    </select>

                    {/* Site Filter */}
                    <select
                        value={selectedSite}
                        onChange={(e) => setSelectedSite(e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', minWidth: '150px' }}
                    >
                        <option value="all">{language === 'th' ? '📍 สถานที่ทั้งหมด' : '📍 All Sites'}</option>
                        {allSites.map(site => (
                            <option key={site} value={site}>{site}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Quick Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="clean-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--primary-color)' }}>
                    <div style={{ fontSize: '1.5rem', background: 'var(--primary-light)', color: 'var(--primary-color)', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👥</div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{language === 'th' ? 'พนักงานทั้งหมด' : 'Total Active'}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{totalEmployees}</div>
                    </div>
                </div>
                <div className="clean-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #10b981' }}>
                    <div style={{ fontSize: '1.5rem', background: '#dcfce7', color: '#15803d', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✅</div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{language === 'th' ? 'มาทำงาน' : 'Present'}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{presentCount}</div>
                    </div>
                </div>
                <div className="clean-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ fontSize: '1.5rem', background: '#fee2e2', color: '#dc2626', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🚫</div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{language === 'th' ? 'ขาด/ลา' : 'Absent'}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{absentCount}</div>
                    </div>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'daily' ? (
                <div className="clean-card">
                    <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                        <h3 style={{ margin: 0 }}>📋 {language === 'th' ? 'รายการเช็คอิน' : 'Check-in List'}: {selectedDate}</h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        {filteredRecords.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#f9fafb' }}>
                                    <tr>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280', fontSize: '0.8rem' }}>{language === 'th' ? 'พนักงาน' : 'Employee'}</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280', fontSize: '0.8rem' }}>{language === 'th' ? 'กะ' : 'Shift'}</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280', fontSize: '0.8rem' }}>{language === 'th' ? 'เข้างาน' : 'In'}</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280', fontSize: '0.8rem' }}>{language === 'th' ? 'ออกงาน' : 'Out'}</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280', fontSize: '0.8rem' }}>{language === 'th' ? 'สถานะ' : 'Status'}</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280', fontSize: '0.8rem' }}>{language === 'th' ? 'สถานที่' : 'Site'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.map((rec: any, idx: number) => (
                                        <tr
                                            key={idx}
                                            style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                                            onClick={() => setPopupEmployee(rec.employeeId)}
                                        >
                                            <td style={{ padding: '0.75rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <img src={rec.photoUrl || 'https://ui-avatars.com/api/?background=random'} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
                                                    <span style={{ fontWeight: 500, color: '#1f2937' }}>{rec.empName}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.9rem' }}>{rec.shift}</td>
                                            <td style={{ padding: '0.75rem', color: '#15803d', fontWeight: 600 }}>{rec.checkInTime}</td>
                                            <td style={{ padding: '0.75rem', color: '#6b7280' }}>{rec.checkOutTime}</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span style={{
                                                    background: rec.status === 'On Time' ? '#dcfce7' : '#fee2e2',
                                                    color: rec.status === 'On Time' ? '#15803d' : '#dc2626',
                                                    padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600
                                                }}>
                                                    {rec.status === 'On Time' ? (language === 'th' ? 'ตรงเวลา' : 'On Time') : (language === 'th' ? 'สาย' : 'Late')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280', fontSize: '0.9rem' }}>{rec.site}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                                {language === 'th' ? 'ไม่พบข้อมูลสำหรับวันที่เลือก' : 'No records found for this date.'}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="clean-card" style={{ padding: '1rem' }}>
                    <h3 style={{ marginTop: 0 }}>🗓️ {language === 'th' ? 'มุมมองปฏิทิน' : 'Calendar View'}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 'bold', marginBottom: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
                        <div>{language === 'th' ? 'อา' : 'Su'}</div>
                        <div>{language === 'th' ? 'จ' : 'Mo'}</div>
                        <div>{language === 'th' ? 'อ' : 'Tu'}</div>
                        <div>{language === 'th' ? 'พ' : 'We'}</div>
                        <div>{language === 'th' ? 'พฤ' : 'Th'}</div>
                        <div>{language === 'th' ? 'ศ' : 'Fr'}</div>
                        <div>{language === 'th' ? 'ส' : 'Sa'}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                        {generateCalendarForEmployee(selectedEmployeeId === 'all' ? 'CR001' : selectedEmployeeId).days.map((day, i) => {
                            const dateStr = day ? `${new Date(selectedDate).getFullYear()}-${String(new Date(selectedDate).getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                            const dayRecords = day ? attendanceRecords.filter((r: any) => {
                                const empMatch = selectedEmployeeId === 'all' || r.employeeId === selectedEmployeeId;
                                return r.date === dateStr && empMatch;
                            }) : [];

                            return (
                                <div key={i} style={{
                                    aspectRatio: '1',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    padding: '0.25rem',
                                    background: day ? 'white' : '#f9fafb',
                                    fontSize: '0.75rem',
                                    position: 'relative'
                                }}>
                                    {day && (
                                        <>
                                            <div style={{ fontWeight: 600, color: '#374151' }}>{day}</div>
                                            <div style={{ display: 'flex', gap: '2px', marginTop: '2px', flexWrap: 'wrap' }}>
                                                {dayRecords.slice(0, 5).map((_: any, idx: number) => (
                                                    <div key={idx} style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Employee Calendar Popup */}
            {popupEmployee && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }} onClick={() => setPopupEmployee(null)}>
                    <div style={{
                        background: 'white', borderRadius: '1rem', padding: '1.5rem', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflow: 'auto'
                    }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <img
                                    src={getPopupEmployeeInfo()?.photoUrl || 'https://ui-avatars.com/api/?background=random'}
                                    alt=""
                                    style={{ width: 50, height: 50, borderRadius: '50%' }}
                                />
                                <div>
                                    <h3 style={{ margin: 0 }}>
                                        {language === 'th'
                                            ? `${getPopupEmployeeInfo()?.firstNameTH} ${getPopupEmployeeInfo()?.lastNameTH}`
                                            : `${getPopupEmployeeInfo()?.firstNameEN} ${getPopupEmployeeInfo()?.lastNameEN}`}
                                    </h3>
                                    <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>{getPopupEmployeeInfo()?.position}</div>
                                </div>
                            </div>
                            <button onClick={() => setPopupEmployee(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>×</button>
                        </div>

                        {/* Calendar */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 'bold', marginBottom: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
                            <div>{language === 'th' ? 'อา' : 'Su'}</div>
                            <div>{language === 'th' ? 'จ' : 'Mo'}</div>
                            <div>{language === 'th' ? 'อ' : 'Tu'}</div>
                            <div>{language === 'th' ? 'พ' : 'We'}</div>
                            <div>{language === 'th' ? 'พฤ' : 'Th'}</div>
                            <div>{language === 'th' ? 'ศ' : 'Fr'}</div>
                            <div>{language === 'th' ? 'ส' : 'Sa'}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                            {generateCalendarForEmployee(popupEmployee).days.map((day, i) => {
                                const { year, month, empRecords } = generateCalendarForEmployee(popupEmployee);
                                const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                                const record = empRecords.find((r: any) => r.date === dateStr);

                                return (
                                    <div key={i} style={{
                                        minHeight: '60px',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '6px',
                                        padding: '0.25rem',
                                        background: record ? (record.status === 'On Time' ? '#dcfce7' : '#fef3c7') : (day ? 'white' : '#f9fafb'),
                                        fontSize: '0.7rem'
                                    }}>
                                        {day && (
                                            <>
                                                <div style={{ fontWeight: 600, color: '#374151', marginBottom: '2px' }}>{day}</div>
                                                {record && (
                                                    <div style={{ fontSize: '0.65rem', color: '#374151' }}>
                                                        <div>🟢 {record.checkInTime}</div>
                                                        <div>🔴 {record.checkOutTime}</div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
