import React, { useState } from 'react';
import { useEmployee } from '../context/EmployeeContext';
import { PinPad } from './PinPad';
import type { Employee } from '../types';

interface PublicUserAuthProps {
    onAuthenticated: (employee: Employee) => void;
    onCancel: () => void;
}

export const PublicUserAuth: React.FC<PublicUserAuthProps> = ({ onAuthenticated, onCancel }) => {
    const { employees } = useEmployee(); // Use dynamic list
    const [step, setStep] = useState<'id' | 'pin-login' | 'pin-setup' | 'pin-confirm'>('id');
    const [employeeId, setEmployeeId] = useState('');
    const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);
    const [setupPin, setSetupPin] = useState('');
    const [error, setError] = useState('');

    const handleIdSubmit = () => {
        const emp = employees.find(e => e.id.toUpperCase() === employeeId.toUpperCase());
        if (!emp) {
            setError('Employee not found');
            return;
        }
        if (emp.status !== 'Active') {
            setError(`Account is ${emp.status}. Access Denied.`);
            return;
        }
        setTargetEmployee(emp);
        if ((emp as any).pin) {
            setStep('pin-login');
        } else {
            setStep('pin-setup');
        }
        setError('');
    };

    const handlePinSubmit = (pin: string) => {
        if (!targetEmployee) return;

        if (step === 'pin-login') {
            if ((targetEmployee as any).pin === pin) {
                onAuthenticated(targetEmployee);
            } else {
                setError('Incorrect PIN');
            }
        }
        else if (step === 'pin-setup') {
            setSetupPin(pin);
            setStep('pin-confirm');
        }
        else if (step === 'pin-confirm') {
            if (pin === setupPin) {
                // Update Mock Data
                (targetEmployee as any).pin = pin;
                // In real app, API call here
                alert('PIN Created Successfully!');
                onAuthenticated(targetEmployee);
            } else {
                setError('PINs do not match. Try again.');
                setStep('pin-setup');
                setSetupPin('');
            }
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '0 auto', background: 'white', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>

            {/* Step 1: ID Input */}
            {step === 'id' && (
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ color: 'var(--primary-color)', marginTop: 0 }}>👤 Identification</h2>
                    <p style={{ color: '#64748b', marginBottom: '2rem' }}>Please enter your Employee ID</p>

                    <input
                        type="text"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        placeholder="EMP..."
                        style={{
                            width: '100%', padding: '1rem', fontSize: '1.2rem', textAlign: 'center',
                            marginBottom: '1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1',
                            letterSpacing: '1px'
                        }}
                    />

                    {error && <div style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</div>}

                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={onCancel}
                            style={{ flex: 1, padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', background: 'transparent' }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleIdSubmit}
                            style={{ flex: 2, padding: '1rem', background: 'var(--primary-color)', color: 'white', borderRadius: '0.5rem', fontWeight: 600, border: 'none' }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Step 2: PIN Login */}
            {step === 'pin-login' && (
                <PinPad
                    title={`Welcome, ${targetEmployee?.firstNameEN}`}
                    subTitle="Enter your 6-digit PIN"
                    onComplete={handlePinSubmit}
                    onBack={() => setStep('id')}
                    error={error}
                />
            )}

            {/* Step 3: PIN Setup */}
            {step === 'pin-setup' && (
                <PinPad
                    title="Create PIN"
                    subTitle="Set a new 6-digit PIN for your account"
                    onComplete={handlePinSubmit}
                    onBack={() => setStep('id')}
                    error={error}
                />
            )}

            {/* Step 4: PIN Confirm */}
            {step === 'pin-confirm' && (
                <PinPad
                    title="Confirm PIN"
                    subTitle="Re-enter your PIN to confirm"
                    onComplete={handlePinSubmit}
                    onBack={() => {
                        setStep('pin-setup');
                        setSetupPin('');
                    }}
                    error={error}
                />
            )}
        </div>
    );
};
