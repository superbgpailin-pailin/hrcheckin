import React from 'react';

interface MetricCardProps {
    icon: string;
    label: string;
    value: string | number;
    tone?: 'blue' | 'green' | 'amber' | 'rose';
}

export const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, tone = 'blue' }) => {
    return (
        <article className={`metric-card tone-${tone}`}>
            <div className="metric-head">
                <span className="metric-icon">{icon}</span>
                <span className="metric-label">{label}</span>
            </div>
            <strong className="metric-value">{value}</strong>
        </article>
    );
};
