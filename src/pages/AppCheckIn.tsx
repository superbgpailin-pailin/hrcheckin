import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { useAppEmployees } from '../context/AppEmployeeContext';
import { useAppLanguage } from '../context/AppLanguageContext';
import { useAppSettings } from '../context/AppSettingsContext';
import type { AppEmployee, AttendanceSummaryRecord, ShiftDefinition } from '../types/app';
import { appAttendanceService } from '../services/appAttendanceService';
import { createQrToken, hasNonceBeenUsed, markNonceAsUsed, verifyQrToken } from '../utils/qrToken';
import { formatThaiDateTime, getAvailableShifts } from '../utils/shiftUtils';

interface AppCheckInProps {
    onBack: () => void;
}

type CheckInStep = 'auth' | 'shift' | 'scan' | 'done';

const findEmployee = (employees: AppEmployee[], employeeId: string, pin: string): AppEmployee | null => {
    const target = employees.find((employee) => employee.id.trim().toUpperCase() === employeeId.trim().toUpperCase());
    if (!target) {
        return null;
    }

    if (target.pin !== pin) {
        return null;
    }

    if (target.status !== 'Active') {
        return null;
    }

    return target;
};

const TEXT = {
    th: {
        title: 'Self Check-in',
        subtitle: 'ลงเวลาเข้าแบบสแกน QR (ไม่มีเช็คเอาท์)',
        stepAuth: 'ยืนยันตัวตน',
        stepShift: 'เลือกกะ',
        stepScan: 'สแกน QR',
        stepDone: 'เสร็จสิ้น',
        employeeId: 'รหัสพนักงาน',
        pin: 'PIN',
        loadingEmployees: 'กำลังโหลดข้อมูลพนักงาน...',
        back: 'กลับ',
        next: 'ถัดไป',
        selectShift: 'เลือกกะทำงาน',
        backToAuth: 'ย้อนกลับ',
        openScanner: 'เปิดกล้องสแกน',
        scanHelp: 'สแกน QR จากหน้าจอ Kiosk เพื่อบันทึกเวลาเข้า (QR เปลี่ยนตลอด)',
        backToShift: 'ย้อนกลับ',
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
        stepScan: 'ស្កេន QR',
        stepDone: 'រួចរាល់',
        employeeId: 'លេខកូដបុគ្គលិក',
        pin: 'PIN',
        loadingEmployees: 'កំពុងផ្ទុកទិន្នន័យបុគ្គលិក...',
        back: 'ត្រឡប់',
        next: 'បន្ទាប់',
        selectShift: 'ជ្រើសវេនការងារ',
        backToAuth: 'ត្រឡប់ក្រោយ',
        openScanner: 'បើកកាមេរ៉ាស្កេន',
        scanHelp: 'ស្កេន QR ពីអេក្រង់ Kiosk ដើម្បីចុះវត្តមាន',
        backToShift: 'ត្រឡប់ក្រោយ',
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
    const { employees, loading } = useAppEmployees();
    const { config } = useAppSettings();

    const [step, setStep] = useState<CheckInStep>('auth');
    const [employeeId, setEmployeeId] = useState('');
    const [pin, setPin] = useState('');
    const [employee, setEmployee] = useState<AppEmployee | null>(null);
    const [selectedShiftId, setSelectedShiftId] = useState<string>('');
    const [result, setResult] = useState<AttendanceSummaryRecord | null>(null);
    const [error, setError] = useState('');
    const [scannerOpen, setScannerOpen] = useState(false);

    const webcamRef = useRef<Webcam>(null);
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

    const submitIdentity = (event: React.FormEvent) => {
        event.preventDefault();
        const target = findEmployee(employees, employeeId, pin);

        if (!target) {
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
        setError('');
        setStep('shift');
    };

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

        const record = await appAttendanceService.recordCheckIn(
            employee,
            selectedShift,
            verified.payload.kioskId,
            config.lateGraceMinutes,
        );

        markNonceAsUsed(verified.payload.nonce, verified.payload.expiresAt);
        setResult(record);
    }, [config.lateGraceMinutes, config.qrSecret, employee, selectedShift]);

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
            void handleQrPayload(code.data)
                .then(() => {
                    setStep('done');
                    setScannerOpen(false);
                    setError('');
                })
                .catch((scanError) => {
                    setError(scanError instanceof Error ? scanError.message : 'สแกนไม่สำเร็จ');
                })
                .finally(() => {
                    processingRef.current = false;
                });
        }, 300);

        return () => {
            clearInterval(timer);
        };
    }, [employee, handleQrPayload, scannerOpen, selectedShift]);

    const restart = () => {
        setStep('auth');
        setEmployee(null);
        setSelectedShiftId('');
        setEmployeeId('');
        setPin('');
        setResult(null);
        setError('');
        setScannerOpen(false);
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
                    {[t.stepAuth, t.stepShift, t.stepScan, t.stepDone].map((title, index) => {
                        const active = index <= (step === 'auth' ? 0 : step === 'shift' ? 1 : step === 'scan' ? 2 : 3);
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

                        {loading ? <div className="form-help">{t.loadingEmployees}</div> : null}

                        <div className="inline-actions">
                            <button type="button" className="btn-muted" onClick={onBack}>{t.back}</button>
                            <button type="submit" className="btn-primary">{t.next}</button>
                        </div>
                    </form>
                ) : null}

                {step === 'shift' && employee ? (
                    <div className="stack-form">
                        <div className="employee-inline">
                            <img src={employee.photoUrl} alt={employee.firstNameEN} />
                            <div>
                                <strong>{employee.firstNameTH} {employee.lastNameTH}</strong>
                                <p>{employee.id} · {employee.role}</p>
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
                                    setStep('scan');
                                    setScannerOpen(true);
                                }}
                            >
                                {t.openScanner}
                            </button>
                        </div>
                    </div>
                ) : null}

                {step === 'scan' ? (
                    <div className="stack-form">
                        <p className="form-help">{t.scanHelp}</p>
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
                        <div className="inline-actions">
                            <button
                                type="button"
                                className="btn-muted"
                                onClick={() => {
                                    setScannerOpen(false);
                                    setStep('shift');
                                }}
                            >
                                {t.backToShift}
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
