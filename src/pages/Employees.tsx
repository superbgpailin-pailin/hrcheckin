import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../data/translations';
import { useEmployee } from '../context/EmployeeContext';
import type { Employee, Role } from '../types';
import './Employees.css';

// Expanded Modal Component
const AddEmployeeModal = ({
    isOpen,
    onClose,
    onSave,
    initialData
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (emp: Partial<Employee>) => void;
    initialData?: Employee | null;
}) => {
    const { language } = useLanguage();
    const t = getTranslation(language);

    // Tab State
    const [activeTab, setActiveTab] = useState<'general' | 'personal' | 'contact'>('general');

    // Field States
    const [idType, setIdType] = useState<'auto' | 'manual'>('auto');
    const [manualId, setManualId] = useState('');
    const [generatedId] = useState(`EMP${Math.floor(1000 + Math.random() * 9000)}`);

    // General
    const [role, setRole] = useState<Role>('Employee');
    const [status, setStatus] = useState<'Active' | 'OnLeave' | 'Resigned'>('Active');
    const [startDate, setStartDate] = useState('');
    const [position, setPosition] = useState('');
    const [department, setDepartment] = useState('');
    const [pin, setPin] = useState('');

    // Personal
    const [firstNameEN, setFirstNameEN] = useState('');
    const [lastNameEN, setLastNameEN] = useState('');
    const [firstNameTH, setFirstNameTH] = useState('');
    const [lastNameTH, setLastNameTH] = useState('');
    const [nickname, setNickname] = useState('');
    const [gender, setGender] = useState('Other');
    const [nationality, setNationality] = useState('Thai');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');

    // Contact
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [address, setAddress] = useState('');
    const [emergencyName, setEmergencyName] = useState('');
    const [emergencyPhone, setEmergencyPhone] = useState('');
    const [emergencyRelation, setEmergencyRelation] = useState('');
    const [lineId, setLineId] = useState('');

    // Initialize
    useEffect(() => {
        if (initialData) {
            setIdType('manual');
            setManualId(initialData.id);
            setRole(initialData.role);
            setStatus(initialData.status);
            setStartDate(initialData.startDate);
            setPosition(initialData.position);
            setDepartment(initialData.department);
            setPin(initialData.pin || '');

            setFirstNameEN(initialData.firstNameEN);
            setLastNameEN(initialData.lastNameEN);
            setFirstNameTH(initialData.firstNameTH);
            setLastNameTH(initialData.lastNameTH);
            setNickname(initialData.nickname);
            setGender(initialData.gender);
            setNationality(initialData.nationality);
            setDateOfBirth(initialData.dateOfBirth);
            setPhotoUrl(initialData.photoUrl);

            setEmail(initialData.email);
            setPhoneNumber(initialData.phoneNumber);
            setAddress(initialData.address);
            setEmergencyName(initialData.emergencyContactName);
            setEmergencyPhone(initialData.emergencyContactPhone);
            setEmergencyRelation(initialData.emergencyContactRelation);
            setLineId(initialData.lineId || '');
        } else {
            // Reset
            setIdType('auto');
            setManualId('');
            setRole('Employee');
            setStatus('Active');
            setStartDate(new Date().toISOString().split('T')[0]);
            setPosition('Employee');
            setDepartment('General');
            setPin('123456'); // Default PIN
            setFirstNameEN('');
            setLastNameEN('');
            setFirstNameTH('');
            setLastNameTH('');
            setNickname('');
            setGender('Other');
            setNationality('Thai');
            setDateOfBirth('2000-01-01');
            setPhotoUrl(`https://ui-avatars.com/api/?name=New+Employee&background=random`);
            setEmail('');
            setPhoneNumber('');
            setAddress('');
            setEmergencyName('');
            setEmergencyPhone('');
            setEmergencyRelation('');
            setLineId('');
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        const finalId = idType === 'auto' ? generatedId : manualId;
        if (!finalId) return alert('ID is required');

        onSave({
            ...(initialData || {}),
            id: finalId,
            role, status, startDate, position, department, pin,
            firstNameEN, lastNameEN, firstNameTH, lastNameTH, nickname,
            gender: gender as any, nationality: nationality as any, dateOfBirth, photoUrl,
            email, phoneNumber, address, lineId,
            emergencyContactName: emergencyName,
            emergencyContactPhone: emergencyPhone,
            emergencyContactRelation: emergencyRelation
        });
        onClose();
    };

    // Helper for tabs
    const tabStyle = (tab: typeof activeTab) => ({
        padding: '0.75rem 1rem',
        cursor: 'pointer',
        borderBottom: activeTab === tab ? '2px solid var(--primary-color)' : '2px solid transparent',
        color: activeTab === tab ? 'var(--primary-color)' : '#6b7280',
        fontWeight: 600
    });

    const inputStyle = { width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem' };
    const labelStyle = { display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 500 };

    return (
        <div className="sidebar-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="clean-card" style={{ padding: '0', width: '700px', maxWidth: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, color: 'var(--primary-color)' }}>{initialData ? t.common.edit : t.employees.createTitle}</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 1rem' }}>
                    <div onClick={() => setActiveTab('general')} style={tabStyle('general')}>📝 General</div>
                    <div onClick={() => setActiveTab('personal')} style={tabStyle('personal')}>👤 Personal</div>
                    <div onClick={() => setActiveTab('contact')} style={tabStyle('contact')}>📞 Contact</div>
                </div>

                {/* Scrollable Content */}
                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>

                    {/* GENERAL TAB */}
                    {activeTab === 'general' && (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            {/* ID */}
                            <div>
                                <label style={labelStyle}>Employee ID</label>
                                {initialData ? (
                                    <div style={{ padding: '0.6rem', background: '#f3f4f6', borderRadius: '6px', color: '#6b7280' }}>🔒 {initialData.id}</div>
                                ) : (
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <label style={{ cursor: 'pointer' }}><input type="radio" checked={idType === 'auto'} onChange={() => setIdType('auto')} /> Auto</label>
                                            <label style={{ cursor: 'pointer' }}><input type="radio" checked={idType === 'manual'} onChange={() => setIdType('manual')} /> Manual</label>
                                        </div>
                                        {idType === 'auto' ? <code style={{ fontWeight: 'bold' }}>{generatedId}</code> : <input value={manualId} onChange={e => setManualId(e.target.value)} style={inputStyle} placeholder="EMP001" />}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Role</label>
                                    <select value={role} onChange={e => setRole(e.target.value as Role)} style={inputStyle}>
                                        <option value="Employee">Employee</option>
                                        <option value="Supervisor">Sup.Admin</option>
                                        <option value="Admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Status</label>
                                    <select value={status} onChange={e => setStatus(e.target.value as any)} style={inputStyle}>
                                        <option value="Active">🟢 Active</option>
                                        <option value="OnLeave">🟠 On Leave</option>
                                        <option value="Resigned">🔴 Resigned</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Department</label>
                                    <input value={department} onChange={e => setDepartment(e.target.value)} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Position</label>
                                    <input value={position} onChange={e => setPosition(e.target.value)} style={inputStyle} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Start Date</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>PIN Code (Access)</label>
                                    <input value={pin} onChange={e => setPin(e.target.value)} style={inputStyle} placeholder="6-digit PIN" maxLength={6} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PERSONAL TAB */}
                    {activeTab === 'personal' && (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                                <img src={photoUrl} alt="Preview" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-color)' }} />
                                <div style={{ marginTop: '0.5rem' }}>
                                    <button onClick={() => window.open(photoUrl, '_blank')} style={{ fontSize: '0.8rem', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>View Full Image</button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>First Name (TH)</label>
                                    <input value={firstNameTH} onChange={e => setFirstNameTH(e.target.value)} style={inputStyle} placeholder="สมชาย" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Last Name (TH)</label>
                                    <input value={lastNameTH} onChange={e => setLastNameTH(e.target.value)} style={inputStyle} placeholder="ใจดี" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>First Name (EN)</label>
                                    <input value={firstNameEN} onChange={e => setFirstNameEN(e.target.value)} style={inputStyle} placeholder="Somchai" />
                                </div>
                                <div>
                                    <label style={labelStyle}>Last Name (EN)</label>
                                    <input value={lastNameEN} onChange={e => setLastNameEN(e.target.value)} style={inputStyle} placeholder="Jaidee" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Nickname</label>
                                    <input value={nickname} onChange={e => setNickname(e.target.value)} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Gender</label>
                                    <select value={gender} onChange={e => setGender(e.target.value)} style={inputStyle}>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Nationality</label>
                                    <input value={nationality} onChange={e => setNationality(e.target.value)} style={inputStyle} />
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Date of Birth</label>
                                <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} style={inputStyle} />
                            </div>
                        </div>
                    )}

                    {/* CONTACT TAB */}
                    {activeTab === 'contact' && (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={labelStyle}>Phone</label>
                                    <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Line ID</label>
                                    <input value={lineId} onChange={e => setLineId(e.target.value)} style={inputStyle} />
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Email</label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
                            </div>

                            <div>
                                <label style={labelStyle}>Current Address</label>
                                <textarea value={address} onChange={e => setAddress(e.target.value)} style={{ ...inputStyle, height: '80px', resize: 'vertical' }} />
                            </div>

                            <div style={{ padding: '1rem', background: '#fff7ed', borderRadius: '8px', border: '1px dashed #fdba74' }}>
                                <h4 style={{ margin: '0 0 1rem 0', color: '#c2410c' }}>🚑 Emergency Contact</h4>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    <input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} style={inputStyle} placeholder="Contact Name" />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <input value={emergencyRelation} onChange={e => setEmergencyRelation(e.target.value)} style={inputStyle} placeholder="Relation (e.g. Wife)" />
                                        <input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} style={inputStyle} placeholder="Phone Number" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div style={{ padding: '1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', border: '1px solid #d1d5db', borderRadius: '6px', background: 'white', cursor: 'pointer' }}>{t.common.cancel}</button>
                    <button onClick={handleSave} style={{ padding: '0.75rem 1.5rem', background: 'var(--primary-color)', color: 'white', borderRadius: '6px', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{t.common.save}</button>
                </div>
            </div>
        </div>
    );
};

export const Employees: React.FC = () => {
    const { language } = useLanguage();
    const t = getTranslation(language);
    const { employees, addEmployee, updateEmployee } = useEmployee();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

    const filteredEmployees = employees.filter(emp =>
        emp.firstNameEN.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.firstNameTH.includes(searchTerm) ||
        emp.nickname.includes(searchTerm) ||
        emp.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSaveEmployee = (newEmp: Partial<Employee>) => {
        if (editingEmployee) {
            updateEmployee({ ...editingEmployee, ...newEmp } as Employee);
        } else {
            const fullEmployee: Employee = {
                ...newEmp as Employee,
                // Ensure required defaults
                role: newEmp.role || 'Employee',
                status: newEmp.status || 'Active',
            };
            addEmployee(fullEmployee);
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 className="page-title" style={{ margin: 0 }}>{t.menu.employees}</h1>
                <button
                    onClick={() => { setEditingEmployee(null); setIsModalOpen(true); }}
                    style={{
                        background: 'var(--primary-color)', color: 'white',
                        padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)', cursor: 'pointer'
                    }}
                >
                    + {t.employees.addEmployee}
                </button>
            </div>

            <div className="employees-controls">
                <input
                    type="text"
                    placeholder="🔍 Search employees (ID, Name)..."
                    className="search-input glass-card"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="employee-grid">
                {filteredEmployees.map(emp => {
                    const isResigned = emp.status === 'Resigned';
                    const isOnLeave = emp.status === 'OnLeave';

                    // Card background color based on status
                    const cardBg = isResigned ? '#fee2e2' : isOnLeave ? '#fef3c7' : '#dcfce7';
                    const statusColor = isResigned ? '#dc2626' : isOnLeave ? '#d97706' : '#15803d';
                    const statusText = isResigned
                        ? (language === 'th' ? 'ลาออก' : 'Resigned')
                        : isOnLeave
                            ? (language === 'th' ? 'ลาพัก' : 'On Leave')
                            : (language === 'th' ? 'ทำงาน' : 'Active');

                    return (
                        <div key={emp.id} className="employee-card" style={{
                            position: 'relative',
                            background: cardBg,
                            borderRadius: '0.75rem',
                            padding: '1rem',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                            border: '1px solid rgba(0,0,0,0.05)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            opacity: isResigned ? 0.7 : 1
                        }}>
                            {/* Avatar */}
                            <div style={{ width: '70px', height: '70px', marginBottom: '0.5rem' }}>
                                <img src={emp.photoUrl} alt={emp.firstNameEN} style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    border: '2px solid white',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }} />
                            </div>

                            {/* Status Badge - UNDER PHOTO */}
                            <div style={{
                                marginBottom: '0.5rem',
                                background: 'white',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '9999px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: statusColor,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                            }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }}></div>
                                {statusText}
                            </div>

                            {/* Info - ALL TEXT IS DARK/BLACK */}
                            <div style={{ textAlign: 'center', width: '100%' }}>
                                <span style={{
                                    background: 'rgba(255,255,255,0.6)',
                                    color: '#374151',
                                    fontSize: '0.65rem',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '3px',
                                    display: 'inline-block',
                                    marginBottom: '0.25rem'
                                }}>
                                    {emp.role}
                                </span>
                                <h3 style={{ color: '#111827', margin: '0 0 0.15rem 0', fontSize: '0.95rem', fontWeight: 600 }}>
                                    {language === 'th' ? `${emp.firstNameTH} ${emp.lastNameTH}` : `${emp.firstNameEN} ${emp.lastNameEN}`}
                                </h3>
                                <div style={{ color: '#4b5563', fontSize: '0.8rem' }}>
                                    {emp.position}
                                </div>
                                <div style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                                    {emp.department}
                                </div>
                                <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                                    {emp.id}
                                </div>
                            </div>

                            {/* Edit Button */}
                            <button
                                onClick={() => { setEditingEmployee(emp); setIsModalOpen(true); }}
                                style={{
                                    position: 'absolute',
                                    top: '0.5rem',
                                    right: '0.5rem',
                                    background: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '26px',
                                    height: '26px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    color: '#4b5563',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ✏️
                            </button>
                        </div>
                    );
                })}
            </div>

            <AddEmployeeModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveEmployee}
                initialData={editingEmployee}
            />
        </div>
    );
};
