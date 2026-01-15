import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { useHoliday } from '../context/HolidayContext';
import { useEmployee } from '../context/EmployeeContext';
import { useSettings } from '../context/SettingsContext';

export const HolidayAdmin: React.FC = () => {
    const { language } = useLanguage();
    getTranslation(language); // For potential future use
    const { config } = useSettings();
    const { employees } = useEmployee();
    const {
        isSelectionOpen,
        setSelectionOpen,
        blockedDates,
        addBlockedDate,
        removeBlockedDate,
        maxPerDayShift,
        setMaxPerShift,
        maxPerPersonMonth,
        setMaxPerPersonMonth,
        selectedHolidays
    } = useHoliday();

    const [newBlockedDate, setNewBlockedDate] = useState('');

    const handleAddBlockedDate = () => {
        if (newBlockedDate) {
            addBlockedDate(newBlockedDate);
            setNewBlockedDate('');
        }
    };

    const getEmployeeName = (empId: string) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return empId;
        return language === 'th' ? `${emp.firstNameTH} ${emp.lastNameTH}` : `${emp.firstNameEN} ${emp.lastNameEN}`;
    };

    const shifts = config.shifts || [
        { name: 'Morning Shift', startTime: '08:00', endTime: '17:00' },
        { name: 'Evening Shift', startTime: '14:00', endTime: '22:00' },
        { name: 'Night Shift', startTime: '22:00', endTime: '06:00' }
    ];

    return (
        <div className="page-container">
            <h1 className="page-title">
                🗓️ {language === 'th' ? 'จัดการวันหยุด' : 'Holiday Management'}
            </h1>

            {/* Toggle Section */}
            <div className="clean-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>
                            {language === 'th' ? '🔐 เปิด/ปิด การเลือกวันหยุด' : '🔐 Enable/Disable Holiday Selection'}
                        </h3>
                        <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>
                            {language === 'th'
                                ? 'หากปิด พนักงานจะไม่สามารถเลือกหรือแก้ไขวันหยุดได้'
                                : 'When disabled, employees cannot select or modify holidays'}
                        </p>
                    </div>
                    <button
                        onClick={() => setSelectionOpen(!isSelectionOpen)}
                        style={{
                            padding: '0.75rem 2rem',
                            borderRadius: '9999px',
                            border: 'none',
                            background: isSelectionOpen ? '#10b981' : '#ef4444',
                            color: 'white',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '1rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isSelectionOpen
                            ? (language === 'th' ? '✅ เปิดอยู่' : '✅ OPEN')
                            : (language === 'th' ? '🔒 ปิดอยู่' : '🔒 CLOSED')}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Blocked Dates Section */}
                <div className="clean-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0 }}>
                        🚫 {language === 'th' ? 'วันที่ห้ามหยุด' : 'Blocked Dates'}
                    </h3>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <input
                            type="date"
                            value={newBlockedDate}
                            onChange={(e) => setNewBlockedDate(e.target.value)}
                            style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                        />
                        <button
                            onClick={handleAddBlockedDate}
                            style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        >
                            + {language === 'th' ? 'เพิ่ม' : 'Add'}
                        </button>
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {blockedDates.length === 0 ? (
                            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>
                                {language === 'th' ? 'ไม่มีวันที่ถูกบล็อค' : 'No blocked dates'}
                            </div>
                        ) : (
                            blockedDates.sort().map(date => (
                                <div key={date} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem',
                                    borderBottom: '1px solid #f3f4f6'
                                }}>
                                    <span>{date}</span>
                                    <button
                                        onClick={() => removeBlockedDate(date)}
                                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Max Per Shift Section */}
                <div className="clean-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginTop: 0 }}>
                        👥 {language === 'th' ? 'จำนวนคนสูงสุดต่อกะ/วัน' : 'Max Employees per Shift/Day'}
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {shifts.map((shift: any) => (
                            <div key={shift.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ flex: 1, fontWeight: 500 }}>{shift.name}</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    value={maxPerDayShift[shift.name] || 2}
                                    onChange={(e) => setMaxPerShift(shift.name, parseInt(e.target.value) || 0)}
                                    style={{ width: '80px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'center' }}
                                />
                                <span style={{ color: '#6b7280' }}>{language === 'th' ? 'คน' : 'people'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Max Per Person Per Month */}
            <div className="clean-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>
                    📆 {language === 'th' ? 'จำนวนวันหยุดสูงสุดต่อคน/เดือน' : 'Max Holidays per Person/Month'}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <input
                        type="number"
                        min="1"
                        max="30"
                        value={maxPerPersonMonth}
                        onChange={(e) => setMaxPerPersonMonth(parseInt(e.target.value) || 1)}
                        style={{ width: '80px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'center', fontSize: '1.1rem' }}
                    />
                    <span style={{ color: '#6b7280' }}>{language === 'th' ? 'วัน / คน / เดือน' : 'days / person / month'}</span>
                </div>
                <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                    {language === 'th'
                        ? 'พนักงานแต่ละคนจะเลือกวันหยุดได้ไม่เกินจำนวนนี้ในแต่ละเดือน'
                        : 'Each employee can select up to this many holidays per month'}
                </p>
            </div>

            {/* Selected Holidays Table */}
            <div className="clean-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>
                    📋 {language === 'th' ? 'รายการวันหยุดที่พนักงานเลือก' : 'Employee Holiday Selections'}
                    <span style={{
                        background: 'var(--primary-light)',
                        color: 'var(--primary-color)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.9rem',
                        marginLeft: '1rem'
                    }}>
                        {selectedHolidays.length} {language === 'th' ? 'รายการ' : 'records'}
                    </span>
                </h3>

                {selectedHolidays.length === 0 ? (
                    <div style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
                        {language === 'th' ? 'ยังไม่มีพนักงานเลือกวันหยุด' : 'No holiday selections yet'}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f9fafb' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280' }}>{language === 'th' ? 'พนักงาน' : 'Employee'}</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280' }}>{language === 'th' ? 'วันที่' : 'Date'}</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280' }}>{language === 'th' ? 'กะ' : 'Shift'}</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#6b7280' }}>{language === 'th' ? 'ส่งคำขอเมื่อ' : 'Requested'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedHolidays.sort((a, b) => a.date.localeCompare(b.date)).map((h, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>{getEmployeeName(h.employeeId)}</td>
                                        <td style={{ padding: '0.75rem' }}>{h.date}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                {h.shift}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.85rem' }}>
                                            {new Date(h.requestedAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
