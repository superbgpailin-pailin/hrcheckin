import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { MOCK_EMPLOYEES } from '../data/mockData';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
    const { language } = useLanguage();
    // const { currentUser } = useAuth();
    const t = getTranslation(language);

    // Mock Stats Calculation
    const totalEmployees = MOCK_EMPLOYEES.length;
    const onTime = Math.floor(totalEmployees * 0.8);
    const late = Math.floor(totalEmployees * 0.1);
    const absent = totalEmployees - onTime - late;

    const StatCard = ({ title, value, icon, change, color }: any) => (
        <div className="stat-card glass-card">
            <div className="stat-header">
                <span className="stat-title">{title}</span>
                <div className="stat-icon" style={{ color: color, background: `${color}20` }}>{icon}</div>
            </div>
            <div className="stat-value">{value}</div>
            <div className={`stat-change ${change.includes('+') ? 'change-up' : 'change-down'}`}>
                {change} Since yesterday
            </div>
        </div>
    );

    return (
        <div className="dashboard-page">
            <h1 className="page-title">{t.menu.dashboard}</h1>

            <div className="dashboard-grid">
                <StatCard
                    title="Total Employees"
                    value={totalEmployees}
                    icon="👥"
                    change="+2%"
                    color="#6366f1"
                />
                <StatCard
                    title="On Time Today"
                    value={onTime}
                    icon="✅"
                    change="+5%"
                    color="#10b981"
                />
                <StatCard
                    title="Late Arrival"
                    value={late}
                    icon="⏰"
                    change="-2%"
                    color="#f59e0b"
                />
                <StatCard
                    title="On Leave"
                    value={absent}
                    icon="🏖️"
                    change="0%"
                    color="#ef4444"
                />
            </div>

            <div className="dashboard-section">
                <div className="chart-card glass-card">
                    <h3 style={{ margin: 0, marginBottom: '1rem' }}>Attendance Trends</h3>
                    <div style={{
                        height: '200px',
                        background: 'linear-gradient(to bottom, transparent, rgba(99, 102, 241, 0.1))',
                        borderBottom: '2px solid #6366f1',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        padding: '0 1rem'
                    }}>
                        {[60, 80, 75, 90, 85, 95, 80].map((h, i) => (
                            <div key={i} style={{
                                width: '30px',
                                height: `${h}%`,
                                background: '#6366f1',
                                borderRadius: '4px 4px 0 0',
                                opacity: 0.7
                            }} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
                        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                    </div>
                </div>

                <div className="recent-activity glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ margin: 0, marginBottom: '1rem' }}>Recent Activity</h3>
                    <div className="activity-list">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="activity-item">
                                <div className="activity-time">08:{30 + i}</div>
                                <div>
                                    <div style={{ fontWeight: 500 }}>Employee {i}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>Checked in at Office</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
