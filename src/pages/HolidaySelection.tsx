import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { useHoliday } from '../context/HolidayContext';
import { useEmployee } from '../context/EmployeeContext';
import { useSettings } from '../context/SettingsContext';
import { MOCK_ATTENDANCE } from '../data/mockData';

export const HolidaySelection: React.FC = () => {
    const { language } = useLanguage();
    getTranslation(language); // For potential future use
    const { employees } = useEmployee();
    const { config } = useSettings();
    const {
        isSelectionOpen,
        blockedDates,
        selectedHolidays,
        addHoliday,
        removeHoliday,
        getHolidaysForEmployee,
        canSelectDate
    } = useHoliday();

    // Auth state
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentEmployee, setCurrentEmployee] = useState<any>(null);
    const [employeeId, setEmployeeId] = useState('');
    const [pin, setPin] = useState('');
    const [authError, setAuthError] = useState('');

    // Selection state
    const [selectedShift, setSelectedShift] = useState('');
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const shifts = config.shifts || [
        { name: 'Morning Shift', startTime: '08:00', endTime: '17:00' },
        { name: 'Evening Shift', startTime: '14:00', endTime: '22:00' },
        { name: 'Night Shift', startTime: '22:00', endTime: '06:00' }
    ];

    const handleLogin = () => {
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) {
            setAuthError(language === 'th' ? 'ไม่พบรหัสพนักงาน' : 'Employee ID not found');
            return;
        }
        // Simple PIN check (in real app: proper auth)
        if (pin !== '1234') { // Default PIN for demo
            setAuthError(language === 'th' ? 'PIN ไม่ถูกต้อง' : 'Invalid PIN');
            return;
        }
        if (emp.status !== 'Active') {
            setAuthError(language === 'th' ? 'บัญชีถูกระงับ' : 'Account is suspended');
            return;
        }
        setCurrentEmployee(emp);
        setIsAuthenticated(true);
        setAuthError('');
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        setCurrentEmployee(null);
        setEmployeeId('');
        setPin('');
    };

    // Calendar generation
    const generateCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);

        return days;
    };

    const formatDate = (day: number) => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const isDateSelected = (day: number) => {
        if (!currentEmployee) return false;
        const dateStr = formatDate(day);
        return selectedHolidays.some(h => h.employeeId === currentEmployee.id && h.date === dateStr);
    };

    const isDateBlocked = (day: number) => {
        const dateStr = formatDate(day);
        return blockedDates.includes(dateStr);
    };

    const handleDateClick = (day: number) => {
        if (!currentEmployee || !selectedShift || !isSelectionOpen) return;

        const dateStr = formatDate(day);

        if (isDateSelected(day)) {
            removeHoliday(currentEmployee.id, dateStr);
        } else {
            const check = canSelectDate(dateStr, selectedShift);
            if (check.allowed) {
                addHoliday(currentEmployee.id, dateStr, selectedShift);
            } else {
                alert(check.reason);
            }
        }
    };

    // Get absence data (mock)
    const getAbsenceDays = () => {
        if (!currentEmployee) return [];
        return MOCK_ATTENDANCE.filter((a: any) =>
            a.employeeId === currentEmployee.id && a.status === 'Late'
        ).map((a: any) => a.date);
    };

    const myHolidays = currentEmployee ? getHolidaysForEmployee(currentEmployee.id) : [];
    const absenceDays = getAbsenceDays();

    // Login Screen
    if (!isAuthenticated) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                <div style={{
                    background: 'white',
                    borderRadius: '1rem',
                    padding: '2rem',
                    width: '100%',
                    maxWidth: '400px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
                }}>
                    <h2 style={{ textAlign: 'center', marginTop: 0 }}>
                        🗓️ {language === 'th' ? 'เลือก/ตรวจสอบวันหยุด' : 'Holiday Selection'}
                    </h2>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            {language === 'th' ? 'รหัสพนักงาน' : 'Employee ID'}
                        </label>
                        <input
                            type="text"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                            placeholder="e.g. CR001"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                            PIN
                        </label>
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="****"
                            maxLength={4}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                        />
                    </div>

                    {authError && (
                        <div style={{ color: '#dc2626', marginBottom: '1rem', textAlign: 'center' }}>
                            ⚠️ {authError}
                        </div>
                    )}

                    <button
                        onClick={handleLogin}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        {language === 'th' ? 'เข้าสู่ระบบ' : 'Login'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '1rem', color: '#6b7280', fontSize: '0.85rem' }}>
                        {language === 'th' ? 'PIN เริ่มต้น: 1234' : 'Default PIN: 1234'}
                    </div>
                </div>
            </div>
        );
    }

    // Main Screen
    return (
        <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '1rem' }}>
            {/* Header */}
            <div style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img
                        src={currentEmployee?.photoUrl || 'https://ui-avatars.com/api/?background=random'}
                        alt=""
                        style={{ width: 50, height: 50, borderRadius: '50%' }}
                    />
                    <div>
                        <h3 style={{ margin: 0 }}>
                            {language === 'th'
                                ? `${currentEmployee?.firstNameTH} ${currentEmployee?.lastNameTH}`
                                : `${currentEmployee?.firstNameEN} ${currentEmployee?.lastNameEN}`}
                        </h3>
                        <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{currentEmployee?.id}</div>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                    {language === 'th' ? 'ออก' : 'Logout'}
                </button>
            </div>

            {/* Status Banner */}
            <div style={{
                background: isSelectionOpen ? '#dcfce7' : '#fee2e2',
                color: isSelectionOpen ? '#15803d' : '#dc2626',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                textAlign: 'center',
                fontWeight: 600
            }}>
                {isSelectionOpen
                    ? (language === 'th' ? '✅ กำลังเปิดให้เลือกวันหยุด' : '✅ Holiday selection is OPEN')
                    : (language === 'th' ? '🔒 ปิดการเลือกวันหยุด (ดูอย่างเดียว)' : '🔒 Holiday selection is CLOSED (View Only)')}
            </div>

            {/* Shift Selection (Only when open) */}
            {isSelectionOpen && (
                <div style={{
                    background: 'white',
                    borderRadius: '1rem',
                    padding: '1rem',
                    marginBottom: '1rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                    <h4 style={{ marginTop: 0 }}>
                        ⏰ {language === 'th' ? 'เลือกกะที่จะลงวันหยุด' : 'Select shift for holiday'}
                    </h4>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {shifts.map((shift: any) => (
                            <button
                                key={shift.name}
                                onClick={() => setSelectedShift(shift.name)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    border: selectedShift === shift.name ? 'none' : '1px solid #d1d5db',
                                    background: selectedShift === shift.name ? 'var(--primary-color)' : 'white',
                                    color: selectedShift === shift.name ? 'white' : '#374151',
                                    cursor: 'pointer',
                                    fontWeight: selectedShift === shift.name ? 600 : 400
                                }}
                            >
                                {shift.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Calendar */}
            <div style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1rem',
                marginBottom: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                {/* Month Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                        style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', cursor: 'pointer' }}
                    >
                        ◀
                    </button>
                    <h3 style={{ margin: 0 }}>
                        {currentMonth.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                        style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', cursor: 'pointer' }}
                    >
                        ▶
                    </button>
                </div>

                {/* Day Headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                    {(language === 'th' ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map(d => (
                        <div key={d}>{d}</div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                    {generateCalendar().map((day, i) => {
                        const isSelected = day ? isDateSelected(day) : false;
                        const isBlocked = day ? isDateBlocked(day) : false;

                        return (
                            <div
                                key={i}
                                onClick={() => day && !isBlocked && handleDateClick(day)}
                                style={{
                                    aspectRatio: '1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '8px',
                                    cursor: day && !isBlocked && isSelectionOpen ? 'pointer' : 'default',
                                    background: isBlocked ? '#fee2e2' : isSelected ? '#10b981' : (day ? 'white' : '#f9fafb'),
                                    color: isBlocked ? '#dc2626' : isSelected ? 'white' : '#374151',
                                    fontWeight: isSelected ? 700 : 400,
                                    border: isBlocked ? '1px dashed #dc2626' : '1px solid #e5e7eb'
                                }}
                            >
                                {day || ''}
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                    <span>🟢 {language === 'th' ? 'เลือกแล้ว' : 'Selected'}</span>
                    <span>🔴 {language === 'th' ? 'ห้ามหยุด' : 'Blocked'}</span>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div style={{ background: '#dcfce7', borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#15803d' }}>{myHolidays.length}</div>
                    <div style={{ color: '#15803d' }}>{language === 'th' ? 'วันหยุดที่เลือก' : 'Holidays Selected'}</div>
                </div>
                <div style={{ background: '#fee2e2', borderRadius: '1rem', padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>{absenceDays.length}</div>
                    <div style={{ color: '#dc2626' }}>{language === 'th' ? 'วันสาย/ขาด' : 'Late/Absent Days'}</div>
                </div>
            </div>
        </div>
    );
};
