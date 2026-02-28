import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { useAppLanguage } from '../context/AppLanguageContext';
import { useAppSettings } from '../context/AppSettingsContext';
import type { AppEmployee, AttendanceSummaryRecord, ShiftDefinition } from '../types/app';
import { appAttendanceService } from '../services/appAttendanceService';
import { appEmployeeService } from '../services/appEmployeeService';
import { appFileUploadService } from '../services/appFileUploadService';
import { createQrToken, hasNonceBeenUsed, markNonceAsUsed, verifyQrToken } from '../utils/qrToken';
import { formatThaiDateTime, getAvailableShifts } from '../utils/shiftUtils';

interface AppCheckInProps {
    onBack: () => void;
}

type CheckInStep = 'auth' | 'shift' | 'selfie' | 'scan' | 'done';

const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const contentType = blob.type || 'image/jpeg';
    return new File([blob], filename, { type: contentType });
};

const TEXT = {
    th: {
        title: 'Self Check-in',
        subtitle: 'ลงเวลาเข้าแบบสแกน QR (ไม่มีเช็คเอาท์)',
        stepAuth: 'ยืนยันตัวตน',
        stepShift: 'เลือกกะ',
        stepSelfie: 'ถ่ายรูปยืนยัน',
        stepScan: 'สแกน QR',
        stepDone: 'เสร็จสิ้น',
        employeeId: 'รหัสพนักงาน',
        pin: 'PIN',
        checkingIdentity: 'กำลังตรวจสอบข้อมูลพนักงาน...',
        back: 'กลับ',
        next: 'ถัดไป',
        selectShift: 'เลือกกะทำงาน',
        backToAuth: 'ย้อนกลับ',
        goToSelfie: 'ไปขั้นตอนถ่ายรูป',
        goToScan: 'ไปสแกน QR',
        scanHelp: 'สแกน QR จากหน้าจอ Kiosk เพื่อบันทึกเวลาเข้า (QR เปลี่ยนตลอด)',
        selfieHelp: 'ถ่ายรูปตัวเองก่อน แล้วจึงสแกน QR เพื่อยืนยันการเช็คอิน',
        selfieRequired: 'กรุณาถ่ายรูปตัวเองก่อนเข้าสู่ขั้นตอนสแกน QR',
        selfieCaptureError: 'ไม่สามารถถ่ายรูปได้ กรุณาลองใหม่',
        qrExpired: 'QR หมดอายุแล้ว กรุณาสแกนใหม่',
        backToShift: 'ย้อนกลับ',
        backToSelfie: 'ย้อนกลับถ่ายรูป',
        takeSelfie: 'ถ่ายรูป',
        retakeSelfie: 'ถ่ายใหม่',
        scanToCheckIn: 'รอสแกน QR เพื่อเช็คอิน',
        confirming: 'กำลังบันทึก...',
        success: 'บันทึกสำเร็จ',
        checkInAt: 'เวลาเข้า',
        estimatedOut: 'เวลาสิ้นสุดกะ (ประมาณ)',
        status: 'สถานะ',
        shift: 'กะ',
        home: 'กลับหน้าหลัก',
        nextPerson: 'เช็คอินคนถัดไป',
        invalidAuth: 'รหัสพนักงานหรือ PIN ไม่ถูกต้อง หรือบัญชีไม่ Active',
        noShift: 'ยังไม่มีกะที่อนุญาตสำหรับผู้ใช้นี้',
        langBtn: 'KH',
    },
    km: {
        title: 'ចុះវត្តមានដោយខ្លួនឯង',
        subtitle: 'ស្កេន QR ដើម្បីចុះវត្តមាន (មិនមាន Check-out)',
        stepAuth: 'ផ្ទៀងផ្ទាត់',
        stepShift: 'ជ្រើសវេន',
        stepSelfie: 'ថតរូបបញ្ជាក់',
        stepScan: 'ស្កេន QR',
        stepDone: 'រួចរាល់',
        employeeId: 'លេខកូដបុគ្គលិក',
        pin: 'PIN',
        checkingIdentity: 'កំពុងផ្ទៀងផ្ទាត់ព័ត៌មានបុគ្គលិក...',
        back: 'ត្រឡប់',
        next: 'បន្ទាប់',
        selectShift: 'ជ្រើសវេនការងារ',
        backToAuth: 'ត្រឡប់ក្រោយ',
        goToSelfie: 'ទៅថតរូប',
        goToScan: 'ទៅស្កេន QR',
        scanHelp: 'ស្កេន QR ពីអេក្រង់ Kiosk ដើម្បីចុះវត្តមាន',
        selfieHelp: 'ថតរូបខ្លួនឯងសិន ហើយបន្ទាប់មកស្កេន QR ដើម្បីបញ្ជាក់ការចុះវត្តមាន',
        selfieRequired: 'សូមថតរូបខ្លួនឯងមុនពេលទៅស្កេន QR',
        selfieCaptureError: 'មិនអាចថតរូបបាន សូមព្យាយាមម្ដងទៀត',
        qrExpired: 'QR ផុតកំណត់ សូមស្កេនម្ដងទៀត',
        backToShift: 'ត្រឡប់ក្រោយ',
        backToSelfie: 'ត្រឡប់ទៅថតរូប',
        takeSelfie: 'ថតរូប',
        retakeSelfie: 'ថតសារឡើងវិញ',
        scanToCheckIn: 'រង់ចាំស្កេន QR ដើម្បីចុះវត្តមាន',
        confirming: 'កំពុងរក្សាទុក...',
        success: 'បានរក្សាទុករួចរាល់',
        checkInAt: 'ម៉ោងចូល',
        estimatedOut: 'ពេលបញ្ចប់វេន (ប្រហែល)',
        status: 'ស្ថានភាព',
        shift: 'វេន',
        home: 'ត្រឡប់មុខដើម',
        nextPerson: 'បុគ្គលិកបន្ទាប់',
        invalidAuth: 'លេខកូដបុគ្គលិក ឬ PIN មិនត្រឹមត្រូវ ឬគណនីមិនសកម្ម',
        noShift: 'មិនមានវេនដែលអនុញ្ញាតសម្រាប់អ្នកប្រើនេះ',
        langBtn: 'TH',
    },
} as const;

export const AppCheckIn: React.FC<AppCheckInProps> = ({ onBack }) => {
    const { language, toggleLanguage } = useAppLanguage();
    const t = TEXT[language];
    const { config } = useAppSettings();

    const [step, setStep] = useState<CheckInStep>('auth');
    const [employeeId, setEmployeeId] = useState('');
    const [pin, setPin] = useState('');
    const [employee, setEmployee] = useState<AppEmployee | null>(null);
    const [selectedShiftId, setSelectedShiftId] = useState<string>('');
    const [result, setResult] = useState<AttendanceSummaryRecord | null>(null);
    const [error, setError] = useState('');
    const [scannerOpen, setScannerOpen] = useState(false);
    const [capturedSelfie, setCapturedSelfie] = useState('');
    const [authenticating, setAuthenticating] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const webcamRef = useRef<Webcam>(null);
    const selfieWebcamRef = useRef<Webcam>(null);
    const processingRef = useRef(false);

    const availableShifts = useMemo(() => {
        if (!employee) {
            return [] as ShiftDefinition[];
        }

        return getAvailableShifts(new Date(), employee.role, config);
    }, [config, employee]);

    const selectedShift = useMemo(() => {
        return availableShifts.find((shift) => shift.id === selectedShiftId) || availableShifts[0] || null;
    }, [availableShifts, selectedShiftId]);

    const qrPreview = useMemo(() => {
        if (!scannerOpen) {
            return '';
        }

        return createQrToken('preview-kiosk', config.qrSecret, config.qrTokenLifetimeSeconds);
    }, [config.qrSecret, config.qrTokenLifetimeSeconds, scannerOpen]);

    const submitIdentity = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setAuthenticating(true);

        try {
            const target = await appEmployeeService.verifyEmployeePin(employeeId, pin);
            if (target.status !== 'Active') {
                setError(t.invalidAuth);
                return;
            }

            const shiftsForEmployee = getAvailableShifts(new Date(), target.role, config);
            if (shiftsForEmployee.length === 0) {
                setError(t.noShift);
                return;
            }

            const preferredShift = shiftsForEmployee.find((shift) => shift.id === target.defaultShiftId) || shiftsForEmployee[0];

            setEmployee(target);
            setSelectedShiftId(preferredShift.id);
            setCapturedSelfie('');
            setScannerOpen(false);
            setStep('shift');
        } catch (authError) {
            const message = authError instanceof Error ? authError.message : '';
            setError(message || t.invalidAuth);
        } finally {
            setAuthenticating(false);
        }
    };

    const finalizeCheckIn = useCallback(async (
        employeeTarget: AppEmployee,
        shiftTarget: ShiftDefinition,
        kioskId: string,
        nonce: string,
        expiresAt: number,
    ): Promise<void> => {
        if (!capturedSelfie) {
            throw new Error(t.selfieRequired);
        }

        const filename = `${employeeTarget.id}-${Date.now()}.jpg`;
        const selfieFile = await dataUrlToFile(capturedSelfie, filename);
        const selfieUrl = await appFileUploadService.uploadCheckInSelfie(selfieFile, employeeTarget.id);
        const record = await appAttendanceService.recordCheckIn(
            employeeTarget,
            shiftTarget,
            kioskId,
            config.lateGraceMinutes,
            selfieUrl,
        );

        markNonceAsUsed(nonce, expiresAt);
        setResult(record);
        setStep('done');
        setError('');
    }, [capturedSelfie, config.lateGraceMinutes, t.selfieRequired]);

    const handleQrPayload = useCallback(async (raw: string): Promise<void> => {
        if (!employee || !selectedShift) {
            return;
        }

        const verified = verifyQrToken(raw, config.qrSecret);
        if (!verified.valid || !verified.payload) {
            throw new Error(verified.reason || 'QR ไม่ถูกต้อง');
        }

        if (hasNonceBeenUsed(verified.payload.nonce)) {
            throw new Error('QR นี้ถูกใช้งานแล้ว');
        }

        await finalizeCheckIn(
            employee,
            selectedShift,
            verified.payload.kioskId,
            verified.payload.nonce,
            verified.payload.expiresAt,
        );
    }, [config.qrSecret, employee, finalizeCheckIn, selectedShift]);

    useEffect(() => {
        if (!scannerOpen || !employee || !selectedShift) {
            return;
        }

        const timer = window.setInterval(() => {
            const webcam = webcamRef.current;
            const video = webcam?.video;
            if (!video || video.readyState !== 4 || processingRef.current) {
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (!context) {
                return;
            }

            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (!code) {
                return;
            }

            processingRef.current = true;
            setSubmitting(true);
            setScannerOpen(false);
            void handleQrPayload(code.data)
                .catch((scanError) => {
                    setError(scanError instanceof Error ? scanError.message : 'สแกนไม่สำเร็จ');
                    setScannerOpen(true);
                })
                .finally(() => {
                    setSubmitting(false);
                    processingRef.current = false;
                });
        }, 300);

        return () => {
            clearInterval(timer);
        };
    }, [employee, handleQrPayload, scannerOpen, selectedShift]);

    const takeSelfie = () => {
        const next = selfieWebcamRef.current?.getScreenshot();
        if (!next) {
            setError(t.selfieCaptureError);
            return;
        }

        setCapturedSelfie(next);
        setError('');
    };

    const restart = () => {
        setStep('auth');
        setEmployee(null);
        setSelectedShiftId('');
        setEmployeeId('');
        setPin('');
        setResult(null);
        setError('');
        setScannerOpen(false);
        setCapturedSelfie('');
        setAuthenticating(false);
        setSubmitting(false);
    };

    return (
        <div className="checkin-screen">
            <div className="checkin-card reveal-up">
                <div className="checkin-header">
                    <div className="inline-actions" style={{ justifyContent: 'space-between', width: '100%' }}>
                        <div>
                            <h2>{t.title}</h2>
                            <p>{t.subtitle}</p>
                        </div>
                        <button type="button" className="btn-muted" onClick={toggleLanguage}>{t.langBtn}</button>
                    </div>
                </div>

                <div className="checkin-stepper">
                    {[t.stepAuth, t.stepShift, t.stepSelfie, t.stepScan, t.stepDone].map((title, index) => {
                        const currentStep = step === 'auth'
                            ? 0
                            : step === 'shift'
                                ? 1
                                : step === 'selfie'
                                    ? 2
                                    : step === 'scan'
                                        ? 3
                                        : 4;
                        const active = index <= currentStep;
                        return <span key={title} className={active ? 'active' : ''}>{title}</span>;
                    })}
                </div>

                {step === 'auth' ? (
                    <form className="stack-form" onSubmit={submitIdentity}>
                        <label htmlFor="employee-id">{t.employeeId}</label>
                        <input
                            id="employee-id"
                            value={employeeId}
                            onChange={(event) => setEmployeeId(event.target.value.toUpperCase())}
                            placeholder="CR003"
                        />

                        <label htmlFor="employee-pin">{t.pin}</label>
                        <input
                            id="employee-pin"
                            type="password"
                            value={pin}
                            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="******"
                        />

                        {authenticating ? <div className="form-help">{t.checkingIdentity}</div> : null}

                        <div className="inline-actions">
                            <button type="button" className="btn-muted" onClick={onBack}>{t.back}</button>
                            <button type="submit" className="btn-primary" disabled={authenticating}>{t.next}</button>
                        </div>
                    </form>
                ) : null}

                {step === 'shift' && employee ? (
                    <div className="stack-form">
                        <div className="employee-inline">
                            <img src={employee.photoUrl} alt={employee.firstNameEN} />
                            <div>
                                <strong>{employee.firstNameTH} {employee.lastNameTH}</strong>
                                <p>{employee.id} | {employee.role}</p>
                            </div>
                        </div>

                        <label>{t.selectShift}</label>
                        <div className="shift-grid">
                            {availableShifts.map((shift) => (
                                <button
                                    type="button"
                                    key={shift.id}
                                    className={`shift-pill ${selectedShift?.id === shift.id ? 'active' : ''}`}
                                    onClick={() => setSelectedShiftId(shift.id)}
                                >
                                    {shift.label}
                                </button>
                            ))}
                        </div>

                        <div className="inline-actions">
                            <button type="button" className="btn-muted" onClick={() => setStep('auth')}>{t.backToAuth}</button>
                            <button
                                type="button"
                                className="btn-primary"
                                disabled={!selectedShift}
                                onClick={() => {
                                    setError('');
                                    setCapturedSelfie('');
                                    setScannerOpen(false);
                                    setStep('selfie');
                                }}
                            >
                                {t.goToSelfie}
                            </button>
                        </div>
                    </div>
                ) : null}

                {step === 'selfie' ? (
                    <div className="stack-form">
                        <p className="form-help">{t.selfieHelp}</p>
                        {capturedSelfie ? (
                            <img src={capturedSelfie} alt="check-in selfie" className="checkin-selfie-preview" />
                        ) : (
                            <div className="scanner-frame">
                                <Webcam
                                    ref={selfieWebcamRef}
                                    audio={false}
                                    width="100%"
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{ facingMode: 'user' }}
                                />
                            </div>
                        )}

                        <div className="inline-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn-muted"
                                onClick={() => {
                                    setError('');
                                    setCapturedSelfie('');
                                    setStep('shift');
                                }}
                                disabled={submitting}
                            >
                                {t.backToShift}
                            </button>
                            <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn-muted"
                                    onClick={takeSelfie}
                                    disabled={submitting}
                                >
                                    {capturedSelfie ? t.retakeSelfie : t.takeSelfie}
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => {
                                        if (!capturedSelfie) {
                                            setError(t.selfieRequired);
                                            return;
                                        }
                                        setError('');
                                        setScannerOpen(true);
                                        setStep('scan');
                                    }}
                                    disabled={!capturedSelfie || submitting}
                                >
                                    {t.goToScan}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}

                {step === 'scan' ? (
                    <div className="stack-form">
                        <p className="form-help">{submitting ? t.confirming : t.scanHelp}</p>
                        <div className="scanner-frame">
                            <Webcam
                                ref={webcamRef}
                                audio={false}
                                width="100%"
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: 'environment' }}
                            />
                        </div>
                        <details>
                            <summary>QR ตัวอย่างสำหรับทดสอบ (dev)</summary>
                            <code style={{ whiteSpace: 'break-spaces' }}>{qrPreview}</code>
                        </details>
                        <div className="inline-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="btn-muted"
                                onClick={() => {
                                    setScannerOpen(false);
                                    setStep('selfie');
                                }}
                                disabled={submitting}
                            >
                                {t.backToSelfie}
                            </button>
                            <button type="button" className="btn-primary" disabled>
                                {submitting ? t.confirming : t.scanToCheckIn}
                            </button>
                        </div>
                    </div>
                ) : null}

                {step === 'done' && result ? (
                    <div className="result-panel">
                        <div className="result-badge">{t.success}</div>
                        <h3>{result.employeeName}</h3>
                        <p>{t.checkInAt}: {formatThaiDateTime(result.checkInAt)}</p>
                        <p>{t.estimatedOut}: {formatThaiDateTime(result.estimatedCheckOutAt)}</p>
                        <p>{t.status}: {result.status}{result.lateMinutes > 0 ? ` (${result.lateMinutes} min)` : ''}</p>
                        <p>{t.shift}: {result.shiftLabel}</p>

                        <div className="inline-actions">
                            <button className="btn-muted" type="button" onClick={onBack}>{t.home}</button>
                            <button className="btn-primary" type="button" onClick={restart}>{t.nextPerson}</button>
                        </div>
                    </div>
                ) : null}

                {error ? <div className="form-error">{error}</div> : null}
            </div>
        </div>
    );
};
