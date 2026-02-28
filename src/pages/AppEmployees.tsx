import React, { useMemo, useState } from 'react';
import { useAppEmployees } from '../context/AppEmployeeContext';
import { useAppSettings } from '../context/AppSettingsContext';
import type { AppEmployee } from '../types/app';
import { appFileUploadService } from '../services/appFileUploadService';
import { downloadCsv } from '../utils/csv';
import { ImageLightbox } from '../components/ImageLightbox';

const EMPLOYEE_ID_PREFIX = 'CR';
const EMPLOYEE_ID_PAD = 3;

const getEmployeeIdCursor = (employees: AppEmployee[]): { maxNumber: number; padLength: number } => {
    let maxNumber = 0;
    let padLength = EMPLOYEE_ID_PAD;

    employees.forEach((employee) => {
        const normalized = employee.id.trim().toUpperCase();
        const matched = normalized.match(/^CR(\d+)$/);
        if (!matched) {
            return;
        }

        const digits = matched[1];
        const parsed = Number.parseInt(digits, 10);
        if (Number.isNaN(parsed)) {
            return;
        }

        if (parsed > maxNumber) {
            maxNumber = parsed;
        }
        if (digits.length > padLength) {
            padLength = digits.length;
        }
    });

    return { maxNumber, padLength };
};

const buildEmployeeId = (number: number, padLength: number): string => {
    return `${EMPLOYEE_ID_PREFIX}${String(number).padStart(padLength, '0')}`;
};

const getNextEmployeeId = (employees: AppEmployee[]): string => {
    const cursor = getEmployeeIdCursor(employees);
    return buildEmployeeId(cursor.maxNumber + 1, cursor.padLength);
};

const getEmployeeIdsFromRange = (value: string): { ids: string[]; error?: undefined } | { ids?: undefined; error: string } => {
    const normalized = value.trim().toUpperCase();
    const matched = normalized.match(/^([A-Z]+)(\d+)\s*-\s*([A-Z]+)(\d+)$/);
    if (!matched) {
        return { error: 'รูปแบบช่วงรหัสไม่ถูกต้อง (ตัวอย่าง: CR001-CR020)' };
    }

    const [, startPrefix, startDigits, endPrefix, endDigits] = matched;
    if (startPrefix !== endPrefix) {
        return { error: 'ช่วงรหัสต้องใช้ Prefix เดียวกัน' };
    }

    const startNumber = Number.parseInt(startDigits, 10);
    const endNumber = Number.parseInt(endDigits, 10);
    if (Number.isNaN(startNumber) || Number.isNaN(endNumber)) {
        return { error: 'ไม่สามารถอ่านเลขรหัสพนักงานได้' };
    }
    if (startNumber > endNumber) {
        return { error: 'รหัสเริ่มต้นต้องน้อยกว่าหรือเท่ารหัสสิ้นสุด' };
    }

    const total = endNumber - startNumber + 1;
    if (total > 500) {
        return { error: 'สร้างได้สูงสุด 500 คนต่อครั้ง' };
    }

    const padLength = Math.max(startDigits.length, endDigits.length, EMPLOYEE_ID_PAD);
    const ids = Array.from({ length: total }, (_, index) => `${startPrefix}${String(startNumber + index).padStart(padLength, '0')}`);
    return { ids };
};

interface EmployeeFieldOptions {
    departments: string[];
    positions: string[];
    statuses: string[];
}

const buildEmployeeDisplayName = (employee: AppEmployee): string => {
    const nickname = employee.nickname.trim();
    if (nickname) {
        return nickname;
    }

    const thaiName = `${employee.firstNameTH} ${employee.lastNameTH}`.replace(/\s+/g, ' ').trim();
    if (thaiName && thaiName !== '-') {
        return thaiName;
    }

    const englishName = `${employee.firstNameEN} ${employee.lastNameEN}`.replace(/\s+/g, ' ').trim();
    if (englishName && englishName !== '-') {
        return englishName;
    }

    return employee.id;
};

const isEmployeeProfileIncomplete = (employee: AppEmployee): boolean => {
    return !employee.nickname.trim()
        && !employee.firstNameTH.trim()
        && !employee.lastNameTH.trim()
        && !employee.firstNameEN.trim()
        && !employee.lastNameEN.trim();
};

const createNewEmployee = (
    id: string,
    status: AppEmployee['status'] = 'Active',
): AppEmployee => {
    return {
        id,
        role: 'Employee',
        firstNameTH: '',
        lastNameTH: '',
        firstNameEN: '',
        lastNameEN: '',
        nickname: '',
        position: '',
        department: '',
        status,
        photoUrl: `https://ui-avatars.com/api/?name=${id}&background=6366f1&color=fff`,
        pin: '111111',
        email: '',
        phoneNumber: '',
        birthDate: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        selfieUrl: '',
        idCardUrl: '',
        passportUrl: '',
        startDate: new Date().toISOString().slice(0, 10),
        defaultShiftId: undefined,
    };
};

interface EmployeeEditorProps {
    employee: AppEmployee;
    fieldOptions: EmployeeFieldOptions;
    onCancel: () => void;
    onSubmit: (employee: AppEmployee) => Promise<void>;
}

interface EmployeeViewerProps {
    employee: AppEmployee;
    onClose: () => void;
}

const withCurrentOption = (options: string[], currentValue: string): string[] => {
    const normalizedCurrent = currentValue.trim();
    if (!normalizedCurrent) {
        return options;
    }

    const hasCurrent = options.some((option) => option.trim().toLowerCase() === normalizedCurrent.toLowerCase());
    return hasCurrent ? options : [normalizedCurrent, ...options];
};

const EmployeeEditor: React.FC<EmployeeEditorProps> = ({ employee, fieldOptions, onCancel, onSubmit }) => {
    const [draft, setDraft] = useState<AppEmployee>(employee);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

    const update = <K extends keyof AppEmployee>(key: K, value: AppEmployee[K]) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
    };

    const uploadImage = async (
        key: 'selfieUrl' | 'idCardUrl' | 'passportUrl',
        category: 'selfie' | 'id-card' | 'passport',
        files: FileList | null,
    ) => {
        const file = files?.[0];
        if (!file) {
            return;
        }

        setUploading(true);
        setError('');
        try {
            const imageUrl = await appFileUploadService.uploadEmployeeImage(file, category, draft.id || 'UNKNOWN');
            update(key, imageUrl as AppEmployee[typeof key]);
            if (key === 'selfieUrl') {
                update('photoUrl', imageUrl);
            }
        } catch (uploadError) {
            setError(uploadError instanceof Error ? uploadError.message : 'อัปโหลดรูปภาพไม่สำเร็จ');
        } finally {
            setUploading(false);
        }
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        await onSubmit({
            ...draft,
            photoUrl: draft.selfieUrl || draft.photoUrl,
            defaultShiftId: undefined,
        });
        setSaving(false);
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

    const departmentOptions = useMemo(
        () => withCurrentOption(fieldOptions.departments, draft.department),
        [draft.department, fieldOptions.departments],
    );
    const positionOptions = useMemo(
        () => withCurrentOption(fieldOptions.positions, draft.position),
        [draft.position, fieldOptions.positions],
    );
    const statusOptions = useMemo(
        () => withCurrentOption(fieldOptions.statuses, draft.status),
        [draft.status, fieldOptions.statuses],
    );

    return (
        <div className="modal-backdrop">
            <form className="modal-card" onSubmit={submit}>
                <h3>ข้อมูลพนักงาน</h3>
                <div className="filter-grid">
                    <div>
                        <label>รหัสพนักงาน</label>
                        <input value={draft.id} onChange={(event) => update('id', event.target.value.toUpperCase())} />
                    </div>
                    <div>
                        <label>PIN</label>
                        <input
                            value={draft.pin}
                            onChange={(event) => update('pin', event.target.value.replace(/\D/g, '').slice(0, 6))}
                        />
                    </div>
                    <div>
                        <label>วันเดือนปีเกิด</label>
                        <input type="date" value={draft.birthDate} onChange={(event) => update('birthDate', event.target.value)} />
                    </div>
                    <div>
                        <label>ชื่อ</label>
                        <input value={draft.firstNameTH} onChange={(event) => update('firstNameTH', event.target.value)} />
                    </div>
                    <div>
                        <label>นามสกุล</label>
                        <input value={draft.lastNameTH} onChange={(event) => update('lastNameTH', event.target.value)} />
                    </div>
                    <div>
                        <label>ชื่อเล่น</label>
                        <input value={draft.nickname} onChange={(event) => update('nickname', event.target.value)} />
                    </div>
                    <div>
                        <label>ชื่อ (EN)</label>
                        <input value={draft.firstNameEN} onChange={(event) => update('firstNameEN', event.target.value)} />
                    </div>
                    <div>
                        <label>นามสกุล (EN)</label>
                        <input value={draft.lastNameEN} onChange={(event) => update('lastNameEN', event.target.value)} />
                    </div>
                    <div>
                        <label>ตำแหน่ง</label>
                        <select
                            value={draft.position}
                            onChange={(event) => update('position', event.target.value)}
                        >
                            {positionOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>แผนก</label>
                        <select
                            value={draft.department}
                            onChange={(event) => update('department', event.target.value)}
                        >
                            {departmentOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>สถานะ</label>
                        <select
                            value={draft.status}
                            onChange={(event) => update('status', event.target.value as AppEmployee['status'])}
                        >
                            {statusOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label>อีเมล</label>
                        <input value={draft.email} onChange={(event) => update('email', event.target.value)} />
                    </div>
                    <div>
                        <label>เบอร์โทร</label>
                        <input value={draft.phoneNumber} onChange={(event) => update('phoneNumber', event.target.value)} />
                    </div>
                    <div>
                        <label>ผู้ติดต่อฉุกเฉิน</label>
                        <input value={draft.emergencyContactName} onChange={(event) => update('emergencyContactName', event.target.value)} />
                    </div>
                    <div>
                        <label>เบอร์โทรฉุกเฉิน</label>
                        <input value={draft.emergencyContactPhone} onChange={(event) => update('emergencyContactPhone', event.target.value)} />
                    </div>
                    <div>
                        <label>วันที่เริ่มงาน</label>
                        <input type="date" value={draft.startDate} onChange={(event) => update('startDate', event.target.value)} />
                    </div>
                    <div>
                        <label>รูปตัวเอง</label>
                        <input type="file" accept="image/*" onChange={(event) => void uploadImage('selfieUrl', 'selfie', event.target.files)} />
                        {renderImagePreview(draft.selfieUrl, 'selfie')}
                    </div>
                    <div>
                        <label>รูปบัตรประชาชน</label>
                        <input type="file" accept="image/*" onChange={(event) => void uploadImage('idCardUrl', 'id-card', event.target.files)} />
                        {renderImagePreview(draft.idCardUrl, 'id card')}
                    </div>
                    <div>
                        <label>รูปพาสปอร์ต</label>
                        <input type="file" accept="image/*" onChange={(event) => void uploadImage('passportUrl', 'passport', event.target.files)} />
                        {renderImagePreview(draft.passportUrl, 'passport')}
                    </div>
                </div>

                {error ? <div className="form-error">{error}</div> : null}

                <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-muted" onClick={onCancel}>ยกเลิก</button>
                    <button type="submit" className="btn-primary" disabled={saving || uploading}>
                        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
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

const EmployeeViewer: React.FC<EmployeeViewerProps> = ({ employee, onClose }) => {
    const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

    const renderImagePreview = (imageUrl: string, alt: string) => {
        if (!imageUrl) {
            return <div className="panel-muted">-</div>;
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

    return (
        <div className="modal-backdrop">
            <div className="modal-card">
                <h3>ข้อมูลพนักงาน</h3>

                <div className="filter-grid">
                    <div>
                        <label>รหัสพนักงาน</label>
                        <input value={employee.id} readOnly />
                    </div>
                    <div>
                        <label>ชื่อ</label>
                        <input value={employee.firstNameTH} readOnly />
                    </div>
                    <div>
                        <label>นามสกุล</label>
                        <input value={employee.lastNameTH} readOnly />
                    </div>
                    <div>
                        <label>ชื่อ (EN)</label>
                        <input value={employee.firstNameEN} readOnly />
                    </div>
                    <div>
                        <label>นามสกุล (EN)</label>
                        <input value={employee.lastNameEN} readOnly />
                    </div>
                    <div>
                        <label>ชื่อเล่น</label>
                        <input value={employee.nickname} readOnly />
                    </div>
                    <div>
                        <label>ตำแหน่ง</label>
                        <input value={employee.position} readOnly />
                    </div>
                    <div>
                        <label>แผนก</label>
                        <input value={employee.department} readOnly />
                    </div>
                    <div>
                        <label>สถานะ</label>
                        <input value={employee.status} readOnly />
                    </div>
                    <div>
                        <label>อีเมล</label>
                        <input value={employee.email} readOnly />
                    </div>
                    <div>
                        <label>เบอร์โทร</label>
                        <input value={employee.phoneNumber} readOnly />
                    </div>
                    <div>
                        <label>วันเดือนปีเกิด</label>
                        <input type="date" value={employee.birthDate} readOnly />
                    </div>
                    <div>
                        <label>ผู้ติดต่อฉุกเฉิน</label>
                        <input value={employee.emergencyContactName} readOnly />
                    </div>
                    <div>
                        <label>เบอร์โทรฉุกเฉิน</label>
                        <input value={employee.emergencyContactPhone} readOnly />
                    </div>
                    <div>
                        <label>วันเริ่มงาน</label>
                        <input type="date" value={employee.startDate} readOnly />
                    </div>
                    <div>
                        <label>รูปตัวเอง</label>
                        {renderImagePreview(employee.selfieUrl || employee.photoUrl, 'selfie')}
                    </div>
                    <div>
                        <label>รูปบัตรประชาชน</label>
                        {renderImagePreview(employee.idCardUrl, 'id card')}
                    </div>
                    <div>
                        <label>รูปพาสปอร์ต</label>
                        {renderImagePreview(employee.passportUrl, 'passport')}
                    </div>
                </div>

                <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-muted" onClick={onClose}>ปิด</button>
                </div>
            </div>

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

export const AppEmployees: React.FC = () => {
    const { employees, loading, error, saveEmployee, saveEmployees, deleteEmployee } = useAppEmployees();
    const { config } = useAppSettings();

    const [query, setQuery] = useState('');
    const [editorState, setEditorState] = useState<AppEmployee | null>(null);
    const [viewerState, setViewerState] = useState<AppEmployee | null>(null);
    const [bulkCreateStart, setBulkCreateStart] = useState('');
    const [bulkCreateEnd, setBulkCreateEnd] = useState('');
    const [bulkCreateNotice, setBulkCreateNotice] = useState('');
    const [bulkCreating, setBulkCreating] = useState(false);

    const employeeFieldOptions = useMemo<EmployeeFieldOptions>(() => {
        const normalize = (values: string[], fallback: string[]) => {
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

            return result.length > 0 ? result : [...fallback];
        };

        return {
            departments: normalize(config.employeeFieldOptions.departments, ['HR', 'Operations']),
            positions: normalize(config.employeeFieldOptions.positions, ['Staff', 'Supervisor']),
            statuses: normalize(config.employeeFieldOptions.statuses, ['Active', 'OnLeave', 'Resigned']),
        };
    }, [config.employeeFieldOptions]);

    const defaultStatus = (employeeFieldOptions.statuses[0] || 'Active') as AppEmployee['status'];

    const filtered = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) {
            return employees;
        }

        return employees.filter((employee) => {
            const fullName = `${employee.firstNameTH} ${employee.lastNameTH} ${employee.firstNameEN} ${employee.lastNameEN}`.toLowerCase();
            const nickname = employee.nickname.toLowerCase();
            return employee.id.toLowerCase().includes(normalized) || fullName.includes(normalized) || nickname.includes(normalized);
        });
    }, [employees, query]);

    const exportCsv = () => {
        const rows = filtered.map((employee) => ({
            id: employee.id,
            name_th: `${employee.firstNameTH} ${employee.lastNameTH}`,
            name_en: `${employee.firstNameEN} ${employee.lastNameEN}`,
            department: employee.department,
            position: employee.position,
            status: employee.status,
            phone: employee.phoneNumber,
            email: employee.email,
            birth_date: employee.birthDate,
            emergency_contact_name: employee.emergencyContactName,
            emergency_contact_phone: employee.emergencyContactPhone,
        }));

        downloadCsv('employees_export.csv', rows);
    };

    const createEmployeesInBulk = async () => {
        const rangeResult = getEmployeeIdsFromRange(`${bulkCreateStart}-${bulkCreateEnd}`);
        if (!rangeResult.ids) {
            setBulkCreateNotice(rangeResult.error);
            return;
        }

        const existingIds = new Set(employees.map((employee) => employee.id.trim().toUpperCase()));
        const duplicatedIds = rangeResult.ids.filter((id) => existingIds.has(id));
        if (duplicatedIds.length > 0) {
            const sample = duplicatedIds.slice(0, 5).join(', ');
            const suffix = duplicatedIds.length > 5 ? ` +${duplicatedIds.length - 5}` : '';
            setBulkCreateNotice(`มีรหัสซ้ำในระบบแล้ว: ${sample}${suffix}`);
            return;
        }

        setBulkCreating(true);
        setBulkCreateNotice('');
        try {
            const items = rangeResult.ids.map((id) => createNewEmployee(id, defaultStatus));
            await saveEmployees(items);
            setBulkCreateNotice(`สร้างพนักงาน ${items.length} คนเรียบร้อย (PIN อัตโนมัติ 111111)`);
            setBulkCreateStart('');
            setBulkCreateEnd('');
        } catch (error) {
            setBulkCreateNotice(error instanceof Error ? error.message : 'สร้างพนักงานไม่สำเร็จ');
        } finally {
            setBulkCreating(false);
        }
    };

    return (
        <div className="portal-grid reveal-up">
            <section className="panel">
                <div className="panel-head">
                    <h3>จัดการข้อมูลพนักงาน</h3>
                    <div className="inline-actions">
                        <button type="button" className="btn-muted" onClick={exportCsv}>Export CSV</button>
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={() => setEditorState(createNewEmployee(getNextEmployeeId(employees), defaultStatus))}
                        >
                            เพิ่มพนักงาน
                        </button>
                    </div>
                </div>

                <div className="filter-grid">
                    <div>
                        <label>ค้นหา</label>
                        <input
                            placeholder="ค้นหาด้วยรหัสหรือชื่อ"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </div>
                    <div>
                        <label>สร้างหลายคนด้วยช่วงรหัส (PIN 111111)</label>
                        <div className="inline-actions" style={{ gap: '0.6rem', flexWrap: 'wrap' }}>
                            <div style={{ minWidth: '160px', flex: '1 1 160px' }}>
                                <label>เริ่ม</label>
                                <input
                                    value={bulkCreateStart}
                                    onChange={(event) => setBulkCreateStart(event.target.value.toUpperCase())}
                                    placeholder="CR003"
                                />
                            </div>
                            <div style={{ minWidth: '160px', flex: '1 1 160px' }}>
                                <label>ถึง</label>
                                <input
                                    value={bulkCreateEnd}
                                    onChange={(event) => setBulkCreateEnd(event.target.value.toUpperCase())}
                                    placeholder="CR010"
                                />
                            </div>
                        </div>
                        <div className="panel-muted">รูปแบบ: เริ่ม CR003 ถึง CR010</div>
                    </div>
                </div>

                <div className="inline-actions" style={{ justifyContent: 'flex-end', marginTop: '0.8rem' }}>
                    <button
                        type="button"
                        className="btn-primary"
                        disabled={bulkCreating}
                        onClick={() => void createEmployeesInBulk()}
                    >
                        {bulkCreating ? 'กำลังสร้าง...' : 'สร้างจากช่วงรหัส'}
                    </button>
                </div>

                {bulkCreateNotice ? <p className="panel-muted" style={{ marginTop: '0.6rem' }}>{bulkCreateNotice}</p> : null}
                {loading ? <p className="panel-muted" style={{ marginTop: '0.6rem' }}>กำลังโหลดข้อมูลพนักงาน...</p> : null}
                {error ? <div className="form-error">{error}</div> : null}
            </section>

            <section className="panel table-panel">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>รหัส</th>
                                <th>ชื่อเล่น</th>
                                <th>แผนก</th>
                                <th>ตำแหน่ง</th>
                                <th>สถานะ</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((employee) => (
                                <tr key={employee.id}>
                                    <td>{employee.id}</td>
                                    <td>
                                        <strong>{buildEmployeeDisplayName(employee)}</strong>
                                        {isEmployeeProfileIncomplete(employee) ? (
                                            <div className="panel-muted">ยังไม่ได้กรอกข้อมูลพนักงาน</div>
                                        ) : null}
                                    </td>
                                    <td>{employee.department}</td>
                                    <td>{employee.position}</td>
                                    <td>{employee.status}</td>
                                    <td>
                                        <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
                                            <button
                                                type="button"
                                                className="btn-muted"
                                                onClick={() => setViewerState(employee)}
                                            >
                                                ดูข้อมูล
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-muted"
                                                onClick={() => setEditorState(employee)}
                                            >
                                                แก้ไข
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-danger"
                                                onClick={() => {
                                                    const shouldDelete = window.confirm(`ลบพนักงาน ${employee.id} ใช่หรือไม่`);
                                                    if (shouldDelete) {
                                                        void deleteEmployee(employee.id);
                                                    }
                                                }}
                                            >
                                                ลบ
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {editorState ? (
                <EmployeeEditor
                    employee={editorState}
                    fieldOptions={employeeFieldOptions}
                    onCancel={() => setEditorState(null)}
                    onSubmit={async (employee) => {
                        await saveEmployee(employee);
                        setEditorState(null);
                    }}
                />
            ) : null}

            {viewerState ? (
                <EmployeeViewer
                    employee={viewerState}
                    onClose={() => setViewerState(null)}
                />
            ) : null}
        </div>
    );
};
