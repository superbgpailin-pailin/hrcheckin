import React, { useState, useEffect } from 'react';
import './PinPad.css';

interface PinPadProps {
    title: string;
    subTitle?: string;
    onComplete: (pin: string) => void;
    onBack?: () => void;
    error?: string;
}

export const PinPad: React.FC<PinPadProps> = ({ title, subTitle, onComplete, onBack, error }) => {
    const [pin, setPin] = useState('');

    useEffect(() => {
        if (pin.length === 6) {
            // Small delay for visual feedback
            const timer = setTimeout(() => {
                onComplete(pin);
                setPin(''); // Reset for next attempt or confirm
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [pin, onComplete]);

    const handleNumClick = (num: number) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
        }
    };

    const handleDel = () => {
        setPin(prev => prev.slice(0, -1));
    };

    return (
        <div className="pin-pad-container">
            <h2 className="pin-title">{title}</h2>
            {subTitle && <p className="pin-subtitle">{subTitle}</p>}

            <div className="pin-display">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
                ))}
            </div>

            {error && <div className="pin-error">{error}</div>}

            <div className="num-pad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button key={num} onClick={() => handleNumClick(num)} className="num-btn">{num}</button>
                ))}
                <button onClick={onBack} className="control-btn footer-btn">⬅</button>
                <button onClick={() => handleNumClick(0)} className="num-btn">0</button>
                <button onClick={handleDel} className="control-btn footer-btn">⌫</button>
            </div>
        </div>
    );
};
