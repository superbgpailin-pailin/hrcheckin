import React, { useState } from 'react';
import { useAppLanguage } from '../context/AppLanguageContext';
import { useAppSettings } from '../context/AppSettingsContext';
import type { AppEmployee, EmployeeProfileDraft } from '../types/app';
import { appEmployeeService } from '../services/appEmployeeService';
import { appFileUploadService } from '../services/appFileUploadService';
import { ImageLightbox } from '../components/ImageLightbox';

interface AppSelfProfileProps {
    onBack: () => void;
}

type ImageDraftKey = 'selfieUrl' | 'idCardUrl' | 'passportUrl';
type ImageCategory = 'selfie' | 'id-card' | 'passport';
type AccessStep = 'verify' | 'form';

const TEXT = {
    th: {
        title: 'Employee Form',
        subtitle: 'กรอกข้อมูลพนักงาน และบันทึกเข้าระบบได้ทันที',
        verifyHint: 'กรอกรหัสพนักงานและ PIN เดิมก่อนเริ่มกรอกข้อมูล (ถ้าจำ PIN ไม่ได้ให้ติดต่อแอดมิน)',
        back: 'กลับหน้าหลัก',
        verifySubmit: 'ยืนยันรหัส',
        verifying: 'กำลังตรวจสอบ...',
        submit: 'บันทึกข้อมูล',
        submitting: 'กำลังบันทึกข้อมูล...',
        startOver: 'เปลี่ยนรหัสพนักงาน',
        verifySuccess: 'ยืนยันรหัสสำเร็จ กรุณากรอกข้อมูลให้ครบ',
        uploadErrorType: 'อัปโหลดได้เฉพาะไฟล์รูปภาพเท่านั้น',
        uploadErrorSize: 'รูปภาพต้องมีขนาดไม่เกิน 5 MB',
        uploadFail: 'อัปโหลดรูปภาพไม่สำเร็จ',
        uploadProgress: 'กำลังอัปโหลดรูปภาพ...',
        uploadDone: 'อัปโหลดรูปภาพเรียบร้อย',
        submitFail: 'ไม่สามารถบันทึกข้อมูลได้',
        updateDone: 'บันทึกข้อมูลพนักงานสำเร็จ',
        employeeIdRequired: 'กรุณากรอกรหัสพนักงาน',
        currentPinRequired: 'กรุณากรอก PIN เดิม',
        newPinRequired: 'PIN ใหม่ต้องมีอย่างน้อย 4 หลัก',
        pinMismatch: 'PIN ใหม่และยืนยัน PIN ใหม่ไม่ตรงกัน',
        employeeNotFound: 'ไม่พบรหัสพนักงานนี้ กรุณาติดต่อแอดมิน',
        lockedAs: 'รหัสพนักงานที่ยืนยันแล้ว',
        forgotPinHint: 'หากจำ PIN เดิมไม่ได้ กรุณาให้แอดมินรีเซ็ต PIN ให้',
        labels: {
            employeeId: 'รหัสพนักงาน',
            pin: 'PIN ที่ใช้ยืนยัน',
            currentPin: 'PIN เดิม',
            newPin: 'PIN ใหม่ (ถ้าต้องการเปลี่ยน)',
            confirmPin: 'ยืนยัน PIN ใหม่',
            birthDate: 'วันเดือนปีเกิด',
            firstName: 'ชื่อ',
            lastName: 'นามสกุล',
            nickname: 'ชื่อเล่น',
            firstNameEn: 'ชื่อ (EN)',
            lastNameEn: 'นามสกุล (EN)',
            position: 'ตำแหน่ง',
            department: 'แผนก',
            email: 'อีเมล',
            phone: 'เบอร์โทร',
            emergencyName: 'ผู้ติดต่อฉุกเฉิน',
            emergencyPhone: 'เบอร์โทรฉุกเฉิน',
            startDate: 'วันเริ่มงาน',
            selfie: 'รูปตัวเอง',
            idCard: 'รูปบัตรประชาชน',
            passport: 'รูปพาสปอร์ต',
            selectPosition: 'เลือกตำแหน่ง',
            selectDepartment: 'เลือกแผนก',
        },
        langBtn: 'KH',
    },
    km: {
        title: 'Employee Form',
        subtitle: 'Complete your profile and save directly to the system',
        verifyHint: 'Enter your employee code and current PIN before filling the form. If you forgot PIN, contact admin.',
        back: 'Back',
        verifySubmit: 'Verify',
        verifying: 'Verifying...',
        submit: 'Save Profile',
        submitting: 'Saving...',
        startOver: 'Change Employee Code',
        verifySuccess: 'Verification successful. Please complete the form.',
        uploadErrorType: 'Only image files are allowed',
        uploadErrorSize: 'Image size must be up to 5 MB',
        uploadFail: 'Image upload failed',
        uploadProgress: 'Uploading image...',
        uploadDone: 'Image uploaded',
        submitFail: 'Unable to save profile',
        updateDone: 'Employee profile saved successfully.',
        employeeIdRequired: 'Please enter employee code',
        currentPinRequired: 'Please enter current PIN',
        newPinRequired: 'New PIN must be at least 4 digits',
        pinMismatch: 'New PIN and confirm PIN do not match',
        employeeNotFound: 'Employee code not found. Please contact admin.',
        lockedAs: 'Verified employee code',
        forgotPinHint: 'If you forgot your PIN, ask admin to reset it.',
        labels: {
            employeeId: 'Employee Code',
            pin: 'Verified PIN',
            currentPin: 'Current PIN',
            newPin: 'New PIN (optional)',
            confirmPin: 'Confirm New PIN',
            birthDate: 'Date of Birth',
            firstName: 'First Name',
            lastName: 'Last Name',
            nickname: 'Nickname',
            firstNameEn: 'First Name (EN)',
            lastNameEn: 'Last Name (EN)',
            position: 'Position',
            department: 'Department',
            email: 'Email',
            phone: 'Phone',
            emergencyName: 'Emergency Contact',
            emergencyPhone: 'Emergency Phone',
            startDate: 'Start Date',
            selfie: 'Selfie',
            idCard: 'ID Card',
            passport: 'Passport',
            selectPosition: 'Select position',
            selectDepartment: 'Select department',
        },
        langBtn: 'TH',
    },
} as const;

const createDraft = (): EmployeeProfileDraft => {
    return {
        employeeId: '',
        pin: '',
        firstNameTH: '',
        lastNameTH: '',
        firstNameEN: '',
        lastNameEN: '',
        nickname: '',
        position: '',
        department: '',
        email: '',
        phoneNumber: '',
        birthDate: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        selfieUrl: '',
        idCardUrl: '',
        passportUrl: '',
        startDate: new Date().toISOString().slice(0, 10),
    };
};

const cleanLegacyValue = (value: string): string => {
    if (value.trim() === '-') {
        return '';
    }
    return value;
};

const buildProfileEmployee = (
    existingEmployee: AppEmployee,
    draft: EmployeeProfileDraft,
): AppEmployee => {
    const fallbackPhoto = existingEmployee.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(draft.employeeId)}&background=334155&color=fff`;

    return {
        ...existingEmployee,
        id: draft.employeeId.trim().toUpperCase(),
        firstNameTH: draft.firstNameTH.trim(),
        lastNameTH: draft.lastNameTH.trim(),
        firstNameEN: draft.firstNameEN.trim(),
        lastNameEN: draft.lastNameEN.trim(),
        nickname: draft.nickname.trim(),
        position: draft.position.trim(),
        department: draft.department.trim(),
        photoUrl: draft.selfieUrl || existingEmployee.photoUrl || fallbackPhoto,
        pin: draft.pin.replace(/\D/g, '').slice(0, 6),
        email: draft.email.trim(),
        phoneNumber: draft.phoneNumber.trim(),
        birthDate: draft.birthDate,
        emergencyContactName: draft.emergencyContactName.trim(),
        emergencyContactPhone: draft.emergencyContactPhone.trim(),
        selfieUrl: draft.selfieUrl,
        idCardUrl: draft.idCardUrl,
        passportUrl: draft.passportUrl,
        startDate: draft.startDate,
        defaultShiftId: undefined,
    };
};

export const AppSelfProfile: React.FC<AppSelfProfileProps> = ({ onBack }) => {
    const { language, toggleLanguage } = useAppLanguage();
    const { config } = useAppSettings();
    const t = TEXT[language];

    const [step, setStep] = useState<AccessStep>('verify');
    const [employeeCode, setEmployeeCode] = useState('');
    const [currentPin, setCurrentPin] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmNewPin, setConfirmNewPin] = useState('');
    const [verifiedEmployee, setVerifiedEmployee] = useState<AppEmployee | null>(null);

    const [draft, setDraft] = useState<EmployeeProfileDraft>(createDraft);
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

    const update = <K extends keyof EmployeeProfileDraft>(key: K, value: EmployeeProfileDraft[K]) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const withCurrentOption = (options: string[], currentValue: string): string[] => {
        const normalizedCurrent = currentValue.trim();
        if (!normalizedCurrent) {
            return options;
        }

        const hasCurrent = options.some((option) => option.trim().toLowerCase() === normalizedCurrent.toLowerCase());
        return hasCurrent ? options : [normalizedCurrent, ...options];
    };

    const normalizeOptions = (values: string[], fallback: string[]): string[] => {
        const seen = new Set<string>();
        const result = values
            .map((value) => value.trim())
            .filter((value) => {
                if (!value) {
                    return false;
                }
                const key = value.toLowerCase();
                if (seen.has(key)) {
                    return false;
                }
                seen.add(key);
                return true;
            });

        return result.length > 0 ? result : fallback;
    };

    const departmentOptions = withCurrentOption(
        normalizeOptions(config.employeeFieldOptions.departments, ['HR', 'Operations']),
        draft.department,
    );
    const positionOptions = withCurrentOption(
        normalizeOptions(config.employeeFieldOptions.positions, ['Staff', 'Supervisor']),
        draft.position,
    );

    const resetToVerifyStep = () => {
        setStep('verify');
        setEmployeeCode('');
        setCurrentPin('');
        setNewPin('');
        setConfirmNewPin('');
        setVerifiedEmployee(null);
        setDraft(createDraft());
        setPreviewImage(null);
    };

    const onImagePick = async (
        key: ImageDraftKey,
        category: ImageCategory,
        fileList: FileList | null,
    ) => {
        const file = fileList?.[0];
        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setError(t.uploadErrorType);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError(t.uploadErrorSize);
            return;
        }

        setUploading(true);
        setNotice(t.uploadProgress);
        setError('');

        try {
            const imageUrl = await appFileUploadService.uploadEmployeeImage(
                file,
                category,
                draft.employeeId || 'UNKNOWN',
            );
            update(key, imageUrl);
            setNotice(t.uploadDone);
        } catch (pickError) {
            setError(pickError instanceof Error ? pickError.message : t.uploadFail);
        } finally {
            setUploading(false);
        }
    };

    const renderImagePreview = (imageUrl: string, alt: string) => {
        if (!imageUrl) {
            return null;
        }

        return (
            <button
                type="button"
                className="image-preview-trigger"
                onClick={() => setPreviewImage({ src: imageUrl, alt })}
                aria-label={`Preview ${alt}`}
            >
                <img src={imageUrl} alt={alt} className="image-preview-thumb" />
            </button>
        );
    };

    const verifyAndUnlock = async () => {
        const normalizedEmployeeId = employeeCode.trim().toUpperCase();
        const sanitizedCurrentPin = currentPin.replace(/\D/g, '').slice(0, 6);
        const sanitizedNewPin = newPin.replace(/\D/g, '').slice(0, 6);
        const sanitizedConfirmNewPin = confirmNewPin.replace(/\D/g, '').slice(0, 6);

        if (!normalizedEmployeeId) {
            setError(t.employeeIdRequired);
            return;
        }
        if (sanitizedCurrentPin.length < 4) {
            setError(t.currentPinRequired);
            return;
        }

        const shouldChangePin = sanitizedNewPin.length > 0 || sanitizedConfirmNewPin.length > 0;
        if (shouldChangePin && sanitizedNewPin.length < 4) {
            setError(t.newPinRequired);
            return;
        }
        if (shouldChangePin && sanitizedNewPin !== sanitizedConfirmNewPin) {
            setError(t.pinMismatch);
            return;
        }

        setSubmitting(true);
        setNotice('');
        setError('');
        try {
            const existingEmployee = await appEmployeeService.verifyEmployeePin(normalizedEmployeeId, sanitizedCurrentPin);

            let effectivePin = sanitizedCurrentPin;
            if (shouldChangePin) {
                await appEmployeeService.updateEmployeePin(normalizedEmployeeId, sanitizedNewPin);
                effectivePin = sanitizedNewPin;
            }

            setEmployeeCode(normalizedEmployeeId);
            setCurrentPin(effectivePin);
            setNewPin('');
            setConfirmNewPin('');
            setVerifiedEmployee(existingEmployee);
            setDraft({
                ...createDraft(),
                employeeId: normalizedEmployeeId,
                pin: effectivePin,
                firstNameTH: cleanLegacyValue(existingEmployee.firstNameTH),
                lastNameTH: cleanLegacyValue(existingEmployee.lastNameTH),
                firstNameEN: cleanLegacyValue(existingEmployee.firstNameEN),
                lastNameEN: cleanLegacyValue(existingEmployee.lastNameEN),
                nickname: cleanLegacyValue(existingEmployee.nickname),
                position: cleanLegacyValue(existingEmployee.position),
                department: cleanLegacyValue(existingEmployee.department),
                email: existingEmployee.email,
                phoneNumber: existingEmployee.phoneNumber,
                birthDate: existingEmployee.birthDate,
                emergencyContactName: existingEmployee.emergencyContactName,
                emergencyContactPhone: existingEmployee.emergencyContactPhone,
                selfieUrl: existingEmployee.selfieUrl,
                idCardUrl: existingEmployee.idCardUrl,
                passportUrl: existingEmployee.passportUrl,
                startDate: existingEmployee.startDate || new Date().toISOString().slice(0, 10),
            });
            setStep('form');
            setNotice(t.verifySuccess);
        } catch (verifyError) {
            setError(verifyError instanceof Error ? verifyError.message : t.submitFail);
        } finally {
            setSubmitting(false);
        }
    };

    const submitProfile = async () => {
        setSubmitting(true);
        setError('');
        setNotice('');
        try {
            const existingEmployee = verifiedEmployee || await appEmployeeService.getEmployeeById(employeeCode);
            if (!existingEmployee) {
                throw new Error(t.employeeNotFound);
            }

            const employee = buildProfileEmployee(existingEmployee, {
                ...draft,
                employeeId: employeeCode,
                pin: draft.pin,
            });
            await appEmployeeService.upsertEmployee(employee, employeeCode);
            setNotice(t.updateDone);
            resetToVerifyStep();
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : t.submitFail);
        } finally {
            setSubmitting(false);
        }
    };

    const onSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (step === 'verify') {
            void verifyAndUnlock();
            return;
        }
        void submitProfile();
    };

    return (
        <div className="checkin-screen">
            <form className="checkin-card reveal-up stack-form" onSubmit={onSubmit}>
                <div className="checkin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div>
                        <h2>{t.title}</h2>
                        <p>{step === 'verify' ? t.verifyHint : t.subtitle}</p>
                    </div>
                    <button type="button" className="btn-muted" onClick={toggleLanguage}>{t.langBtn}</button>
                </div>

                {step === 'verify' ? (
                    <>
                        <div className="filter-grid">
                            <div>
                                <label>{t.labels.employeeId}</label>
                                <input
                                    value={employeeCode}
                                    onChange={(event) => setEmployeeCode(event.target.value.toUpperCase())}
                                    placeholder="CR004"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label>{t.labels.currentPin}</label>
                                <input
                                    type="password"
                                    value={currentPin}
                                    onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="123456"
                                />
                            </div>
                            <div>
                                <label>{t.labels.newPin}</label>
                                <input
                                    type="password"
                                    value={newPin}
                                    onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="123456"
                                />
                            </div>
                            <div>
                                <label>{t.labels.confirmPin}</label>
                                <input
                                    type="password"
                                    value={confirmNewPin}
                                    onChange={(event) => setConfirmNewPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="123456"
                                />
                            </div>
                        </div>
                        <div className="panel-muted">{t.forgotPinHint}</div>
                    </>
                ) : (
                    <>
                        <div className="result-panel">
                            <p>{t.lockedAs}: <strong>{employeeCode}</strong></p>
                        </div>

                        <div className="filter-grid">
                            <div>
                                <label>{t.labels.employeeId}</label>
                                <input value={draft.employeeId} readOnly />
                            </div>
                            <div>
                                <label>{t.labels.pin}</label>
                                <input type="password" value={draft.pin} readOnly />
                            </div>
                            <div>
                                <label>{t.labels.birthDate}</label>
                                <input type="date" value={draft.birthDate} onChange={(event) => update('birthDate', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.firstName}</label>
                                <input value={draft.firstNameTH} onChange={(event) => update('firstNameTH', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.lastName}</label>
                                <input value={draft.lastNameTH} onChange={(event) => update('lastNameTH', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.nickname}</label>
                                <input value={draft.nickname} onChange={(event) => update('nickname', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.firstNameEn}</label>
                                <input value={draft.firstNameEN} onChange={(event) => update('firstNameEN', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.lastNameEn}</label>
                                <input value={draft.lastNameEN} onChange={(event) => update('lastNameEN', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.position}</label>
                                <select value={draft.position} onChange={(event) => update('position', event.target.value)}>
                                    <option value="">{t.labels.selectPosition}</option>
                                    {positionOptions.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label>{t.labels.department}</label>
                                <select value={draft.department} onChange={(event) => update('department', event.target.value)}>
                                    <option value="">{t.labels.selectDepartment}</option>
                                    {departmentOptions.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label>{t.labels.email}</label>
                                <input value={draft.email} onChange={(event) => update('email', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.phone}</label>
                                <input value={draft.phoneNumber} onChange={(event) => update('phoneNumber', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.emergencyName}</label>
                                <input value={draft.emergencyContactName} onChange={(event) => update('emergencyContactName', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.emergencyPhone}</label>
                                <input value={draft.emergencyContactPhone} onChange={(event) => update('emergencyContactPhone', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.startDate}</label>
                                <input type="date" value={draft.startDate} onChange={(event) => update('startDate', event.target.value)} />
                            </div>
                            <div>
                                <label>{t.labels.selfie}</label>
                                <input type="file" accept="image/*" onChange={(event) => void onImagePick('selfieUrl', 'selfie', event.target.files)} />
                                {renderImagePreview(draft.selfieUrl, 'selfie preview')}
                            </div>
                            <div>
                                <label>{t.labels.idCard}</label>
                                <input type="file" accept="image/*" onChange={(event) => void onImagePick('idCardUrl', 'id-card', event.target.files)} />
                                {renderImagePreview(draft.idCardUrl, 'id card preview')}
                            </div>
                            <div>
                                <label>{t.labels.passport}</label>
                                <input type="file" accept="image/*" onChange={(event) => void onImagePick('passportUrl', 'passport', event.target.files)} />
                                {renderImagePreview(draft.passportUrl, 'passport preview')}
                            </div>
                        </div>
                    </>
                )}

                {error ? <div className="form-error">{error}</div> : null}
                {notice ? <div className="result-panel"><p>{notice}</p></div> : null}

                <div className="inline-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-muted" onClick={onBack}>{t.back}</button>
                    {step === 'form' ? (
                        <button
                            type="button"
                            className="btn-muted"
                            onClick={() => {
                                setError('');
                                setNotice('');
                                resetToVerifyStep();
                            }}
                        >
                            {t.startOver}
                        </button>
                    ) : null}
                    <button type="submit" className="btn-primary" disabled={submitting || uploading}>
                        {step === 'verify'
                            ? (submitting ? t.verifying : t.verifySubmit)
                            : (submitting ? t.submitting : t.submit)}
                    </button>
                </div>
            </form>

            {previewImage ? (
                <ImageLightbox
                    imageUrl={previewImage.src}
                    alt={previewImage.alt}
                    onClose={() => setPreviewImage(null)}
                />
            ) : null}
        </div>
    );
};
