import React, { useState } from 'react';
import { PublicUserAuth } from '../components/PublicUserAuth';
import { useLanguage } from '../context/LanguageContext';
import { useHoliday } from '../context/HolidayContext';
import { useSettings } from '../context/SettingsContext';
import { MOCK_ATTENDANCE } from '../data/mockData';

export const HistoryAndHoliday: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { language } = useLanguage();
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

    // UI state
    const [activeTab, setActiveTab] = useState<'history' | 'holiday'>('history');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedShift, setSelectedShift] = useState('');

    const shifts = config.shifts || [
        { id: '1', name: 'Morning Shift', start: '08:00', end: '17:00' },
        { id: '2', name: 'Afternoon Shift', start: '14:00', end: '22:00' },
        { id: '3', name: 'Night Shift', start: '22:00', end: '07:00' }
    ];

    const handleAuth = (employee: any) => {
        setCurrentEmployee(employee);
        setIsAuthenticated(true);
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

    // Get data for current employee
    const getAttendanceForDate = (dateStr: string) => {
        if (!currentEmployee) return null;
        return MOCK_ATTENDANCE.find(a => a.employeeId === currentEmployee.id && a.date === dateStr);
    };

    const isHoliday = (dateStr: string) => {
        if (!currentEmployee) return false;
        return selectedHolidays.some(h => h.employeeId === currentEmployee.id && h.date === dateStr);
    };

    const isBlocked = (dateStr: string) => blockedDates.includes(dateStr);

    const handleDateClick = (day: number) => {
        if (!currentEmployee || !selectedShift || !isSelectionOpen || activeTab !== 'holiday') return;

        const dateStr = formatDate(day);
        if (isBlocked(dateStr)) return;

        if (isHoliday(dateStr)) {
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

    const myHolidays = currentEmployee ? getHolidaysForEmployee(currentEmployee.id) : [];
    const myAttendance = currentEmployee
        ? MOCK_ATTENDANCE.filter(a => a.employeeId === currentEmployee.id)
        : [];

    // Calculate OT (check-in on holiday)
    const otDays = myAttendance.filter(a => isHoliday(a.date)).length;
    const lateDays = myAttendance.filter(a => a.status === 'Late' && !isHoliday(a.date)).length;

    // Not authenticated - show login
    if (!isAuthenticated) {
        return (
            <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    📅 {language === 'th' ? 'ประวัติ & วันหยุด' : 'History & Holidays'}
                </h2>
                <PublicUserAuth onAuthenticated={handleAuth} onCancel={onBack} />
                <button
                    onClick={onBack}
                    style={{ marginTop: '1rem', width: '100%', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                >
                    ✖ {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
            </div>
        );
    }

    // Authenticated - show main UI
    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
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
                    onClick={onBack}
                    style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                    {language === 'th' ? 'ออก' : 'Exit'}
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ background: '#dcfce7', borderRadius: '0.75rem', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#15803d' }}>{myAttendance.length}</div>
                    <div style={{ color: '#15803d', fontSize: '0.75rem' }}>{language === 'th' ? 'เช็คอิน' : 'Check-ins'}</div>
                </div>
                <div style={{ background: '#dbeafe', borderRadius: '0.75rem', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1d4ed8' }}>{myHolidays.length}</div>
                    <div style={{ color: '#1d4ed8', fontSize: '0.75rem' }}>{language === 'th' ? 'วันหยุด' : 'Holidays'}</div>
                </div>
                <div style={{ background: '#fae8ff', borderRadius: '0.75rem', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a855f7' }}>{otDays}</div>
                    <div style={{ color: '#a855f7', fontSize: '0.75rem' }}>OT</div>
                </div>
                <div style={{ background: '#fef3c7', borderRadius: '0.75rem', padding: '0.75rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d97706' }}>{lateDays}</div>
                    <div style={{ color: '#d97706', fontSize: '0.75rem' }}>{language === 'th' ? 'สาย' : 'Late'}</div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                    onClick={() => setActiveTab('history')}
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeTab === 'history' ? 'var(--primary-color)' : 'white',
                        color: activeTab === 'history' ? 'white' : '#374151',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    📋 {language === 'th' ? 'ประวัติเช็คอิน' : 'Check-in History'}
                </button>
                <button
                    onClick={() => setActiveTab('holiday')}
                    style={{
                        flex: 1,
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeTab === 'holiday' ? 'var(--primary-color)' : 'white',
                        color: activeTab === 'holiday' ? 'white' : '#374151',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    🗓️ {language === 'th' ? 'เลือกวันหยุด' : 'Select Holidays'}
                </button>
            </div>

            {/* Holiday Mode Banner */}
            {activeTab === 'holiday' && (
                <div style={{
                    background: isSelectionOpen ? '#dcfce7' : '#fee2e2',
                    color: isSelectionOpen ? '#15803d' : '#dc2626',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    textAlign: 'center',
                    fontSize: '0.9rem'
                }}>
                    {isSelectionOpen
                        ? (language === 'th' ? '✅ เปิดให้เลือกวันหยุด' : '✅ Holiday selection OPEN')
                        : (language === 'th' ? '🔒 ปิดการเลือก (ดูอย่างเดียว)' : '🔒 Selection CLOSED (View Only)')}
                </div>
            )}

            {/* Shift Selection for Holiday */}
            {activeTab === 'holiday' && isSelectionOpen && (
                <div style={{ background: 'white', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#6b7280' }}>
                        {language === 'th' ? 'เลือกกะก่อนเพื่อลงวันหยุด:' : 'Select shift before choosing holidays:'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {shifts.map((shift: any) => (
                            <button
                                key={shift.id}
                                onClick={() => setSelectedShift(shift.name)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    border: selectedShift === shift.name ? 'none' : '1px solid #d1d5db',
                                    background: selectedShift === shift.name ? 'var(--primary-color)' : 'white',
                                    color: selectedShift === shift.name ? 'white' : '#374151',
                                    cursor: 'pointer',
                                    fontWeight: selectedShift === shift.name ? 600 : 400,
                                    fontSize: '0.85rem'
                                }}
                            >
                                {shift.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Calendar */}
            <div style={{ background: 'white', borderRadius: '1rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    {(language === 'th' ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']).map(d => (
                        <div key={d}>{d}</div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                    {generateCalendar().map((day, i) => {
                        if (!day) return <div key={i} style={{ background: '#f9fafb', borderRadius: '8px', aspectRatio: '1' }} />;

                        const dateStr = formatDate(day);
                        const attendance = getAttendanceForDate(dateStr);
                        const holiday = isHoliday(dateStr);
                        const blocked = isBlocked(dateStr);
                        const isOT = attendance && holiday;

                        let bg = 'white';
                        let color = '#374151';
                        if (blocked) { bg = '#fee2e2'; color = '#dc2626'; }
                        else if (isOT) { bg = '#fae8ff'; color = '#a855f7'; } // OT = purple
                        else if (holiday) { bg = '#dbeafe'; color = '#1d4ed8'; } // Holiday = blue
                        else if (attendance) { bg = attendance.status === 'Late' ? '#fef3c7' : '#dcfce7'; color = attendance.status === 'Late' ? '#d97706' : '#15803d'; }

                        return (
                            <div
                                key={i}
                                onClick={() => activeTab === 'holiday' && day && handleDateClick(day)}
                                style={{
                                    aspectRatio: '1',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '8px',
                                    cursor: activeTab === 'holiday' && isSelectionOpen && !blocked ? 'pointer' : 'default',
                                    background: bg,
                                    color: color,
                                    fontWeight: attendance || holiday ? 700 : 400,
                                    border: '1px solid #e5e7eb',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <div>{day}</div>
                                {attendance && (
                                    <div style={{ fontSize: '0.6rem', marginTop: '2px' }}>
                                        {isOT ? 'OT' : attendance.checkInTime}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.75rem', color: '#6b7280', flexWrap: 'wrap' }}>
                    <span>🟢 {language === 'th' ? 'ตรงเวลา' : 'On Time'}</span>
                    <span>🟡 {language === 'th' ? 'สาย' : 'Late'}</span>
                    <span>🔵 {language === 'th' ? 'วันหยุด' : 'Holiday'}</span>
                    <span>🟣 OT</span>
                    <span>🔴 {language === 'th' ? 'ห้ามหยุด' : 'Blocked'}</span>
                </div>
            </div>
        </div>
    );
};
