import React, { useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { useAuth } from '../context/AuthContext';
import { attendanceService } from '../services/attendanceService';

// Simple Calendar Component
const Calendar = ({ events }: { events: any[] }) => {
    const daysInMonth = 31; // Simplified, ideally dynamic based on selected month
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '0.5rem',
            marginTop: '1rem'
        }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', color: '#64748b' }}>
                    {d}
                </div>
            ))}
            {days.map(day => {
                // Find event for this day
                // Note: The date string is typically YYYY-MM-DD
                const event = events.find(e => {
                    const d = new Date(e.date);
                    return d.getDate() === day;
                });

                return (
                    <div key={day} style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.5rem',
                        height: '80px',
                        padding: '0.25rem',
                        background: event ? (event.status === 'On Time' ? '#ecfdf5' : '#fef2f2') : 'white',
                        position: 'relative'
                    }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{day}</div>
                        {event && (
                            <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
                                <div style={{ color: '#059669' }}>IN: {event.checkIn || '-'}</div>
                                <div style={{ color: '#dc2626' }}>OUT: {event.checkOut || '-'}</div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export const AttendanceHistory: React.FC = () => {
    const { language } = useLanguage();
    const t = getTranslation(language);
    const { currentUser } = useAuth();

    const [historyData, setHistoryData] = useState<any[]>([]);
    const [stats, setStats] = useState({ total: 0, onTime: 0, late: 0 });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;
            try {
                const logs = await attendanceService.getHistory(currentUser.id);

                // Process logs into Daily Summaries
                const daysMap = new Map<string, any>();

                logs.forEach(log => {
                    // Extract Date part (YYYY-MM-DD)
                    const dateObj = new Date(log.timestamp);
                    const dateStr = dateObj.toISOString().split('T')[0];
                    const timeStr = dateObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

                    if (!daysMap.has(dateStr)) {
                        daysMap.set(dateStr, {
                            date: dateStr,
                            checkIn: null,
                            checkOut: null,
                            status: 'On Time' // Default to On Time unless Late is found
                        });
                    }

                    const entry = daysMap.get(dateStr);

                    if (log.type === 'check_in') {
                        // If multiple check-ins, take the earliest? Or just last? 
                        // Usually earliest is the main check-in.
                        if (!entry.checkIn || timeStr < entry.checkIn) {
                            entry.checkIn = timeStr;
                        }
                        // If any log is 'Late', mark day as Late
                        if (log.status === 'Late') entry.status = 'Late';
                    } else if (log.type === 'check_out') {
                        // Take latest check-out
                        if (!entry.checkOut || timeStr > entry.checkOut) {
                            entry.checkOut = timeStr;
                        }
                    }
                });

                const processedData = Array.from(daysMap.values());
                setHistoryData(processedData);

                // Calculate Stats
                const total = processedData.length;
                const late = processedData.filter(d => d.status === 'Late').length;
                const onTime = total - late;
                setStats({ total, onTime, late });

            } catch (error) {
                console.error("Failed to fetch history:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [currentUser]);

    return (
        <div className="history-page">
            <h1 className="page-title">{t.landing.history}</h1>

            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>
                        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        User: {currentUser?.firstNameEN}
                    </div>
                </div>

                {isLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading history...</div>
                ) : (
                    <Calendar events={historyData} />
                )}
            </div>

            <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>Summary</h3>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    <div>
                        <div style={{ fontWeight: 500, color: '#64748b' }}>Total Days</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total}</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 500, color: '#059669' }}>On Time</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.onTime}</div>
                    </div>
                    <div>
                        <div style={{ fontWeight: 500, color: '#dc2626' }}>Late</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.late}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
