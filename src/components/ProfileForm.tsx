import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getTranslation } from '../data/translations';
import type { Employee } from '../types';
import './ProfileForm.css';

interface ProfileFormProps {
    initialData: Employee;
    readOnly?: boolean;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ initialData, readOnly = false }) => {
    const { language } = useLanguage();
    const { currentUser } = useAuth();
    const t = getTranslation(language);

    const [formData, setFormData] = useState<Employee>(initialData);
    const [isEditing, setIsEditing] = useState(false);

    // Reset form when initialData changes (e.g. switching users)
    useEffect(() => {
        setFormData(initialData);
        setIsEditing(false); // ID 7643b2: Reset edit mode when data changes
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        // In a real app, this would be an API call
        console.log('Saving mock data:', formData);
        alert('บันทึกข้อมูลเรียบร้อย (Mock Save)');
        setIsEditing(false);
    };

    const isFieldEditable = (fieldName: keyof Employee) => {
        if (readOnly) return false;
        if (!currentUser) return false;
        if (currentUser.role === 'Admin') return true;

        // Employee/Supervisor restrictions
        const sensitiveFields: (keyof Employee)[] = [
            'id', 'role', 'position', 'department', 'startDate', 'employeeId' as any
        ];

        return !sensitiveFields.includes(fieldName);
    };

    const InputField = ({ name, label, type = 'text', options }: { name: keyof Employee; label: string; type?: string; options?: { value: string; label: string }[] }) => {
        const editable = isEditing && isFieldEditable(name);

        return (
            <div className="form-group">
                <label className="form-label">{label}</label>
                {options ? (
                    <select
                        name={name}
                        value={formData[name] as string}
                        onChange={handleChange}
                        className="form-input"
                        disabled={!editable}
                    >
                        {options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        type={type}
                        name={name}
                        value={formData[name] as string}
                        onChange={handleChange}
                        className="form-input"
                        disabled={!editable}
                    />
                )}
            </div>
        );
    };

    return (
        <div className="profile-form-container glass-card">
            <div className="form-header">
                <h2 className="form-title">{t.profile.title}</h2>
                {!readOnly && !isEditing && (
                    <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                        {t.common.edit}
                    </button>
                )}
            </div>

            <div className="profile-avatar-section">
                <img src={formData.photoUrl} alt="Profile" className="profile-avatar" />
                {isEditing && isFieldEditable('photoUrl') && (
                    <div style={{ marginTop: '0.5rem' }}>
                        <input type="text" name="photoUrl" value={formData.photoUrl} onChange={handleChange} className="form-input" placeholder="Image URL" style={{ width: '300px' }} />
                    </div>
                )}
            </div>

            <div className="form-section">
                <div className="section-title">🆔 {t.profile.personalInfo}</div>
                <div className="form-grid">
                    <InputField name="id" label={t.profile.employeeId} />
                    <InputField name="nickname" label={t.profile.nickname} />
                    <InputField name="firstNameTH" label={`${t.profile.firstName} (TH)`} />
                    <InputField name="lastNameTH" label={`${t.profile.lastName} (TH)`} />
                    <InputField name="firstNameEN" label={`${t.profile.firstName} (EN)`} />
                    <InputField name="lastNameEN" label={`${t.profile.lastName} (EN)`} />

                    <InputField
                        name="gender"
                        label="Gender"
                        type="select"
                        options={[
                            { value: 'Male', label: 'Male' },
                            { value: 'Female', label: 'Female' }
                        ]}
                    />
                    <InputField name="dateOfBirth" label="Date of Birth" type="date" />
                    <InputField
                        name="nationality"
                        label="Nationality"
                        type="select"
                        options={[
                            { value: 'Thai', label: 'Thai' },
                            { value: 'Laotian', label: 'Laotian' },
                            { value: 'Cambodian', label: 'Cambodian' }
                        ]}
                    />
                </div>
            </div>

            <div className="form-section">
                <div className="section-title">📞 {t.profile.contactInfo}</div>
                <div className="form-grid">
                    <InputField name="email" label={t.profile.email} />
                    <InputField name="phoneNumber" label={t.profile.phone} />
                    <InputField name="address" label={t.profile.address} />
                    <InputField name="emergencyContactName" label={t.profile.emergencyContact} />
                    <InputField name="emergencyContactPhone" label={`${t.profile.emergencyContact} (Tel)`} />
                </div>
            </div>

            <div className="form-section">
                <div className="section-title">💼 {t.profile.workInfo}</div>
                <div className="form-grid">
                    <InputField name="position" label={t.profile.position} />
                    <InputField name="department" label={t.profile.department} />
                    <InputField name="startDate" label={t.profile.startDate} type="date" />
                </div>
            </div>

            {isEditing && (
                <div className="form-actions">
                    <button className="btn btn-secondary" onClick={() => { setIsEditing(false); setFormData(initialData); }}>
                        {t.common.cancel}
                    </button>
                    <button className="btn btn-primary" onClick={handleSave}>
                        {t.common.save}
                    </button>
                </div>
            )}
        </div>
    );
};
