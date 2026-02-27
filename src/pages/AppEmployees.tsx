import React, { useMemo, useState } from 'react';
import { useAppEmployees } from '../context/AppEmployeeContext';
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

const createNewEmployee = (id: string): AppEmployee => {
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
        status: 'Active',
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
    onCancel: () => void;
    onSubmit: (employee: AppEmployee) => Promise<void>;
}

interface EmployeeViewerProps {
    employee: AppEmployee;
    onClose: () => void;
}

const EmployeeEditor: React.FC<EmployeeEditorProps> = ({ employee, onCancel, onSubmit }) => {
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
                        <input value={draft.position} onChange={(event) => update('position', event.target.value)} />
                    </div>
                    <div>
                        <label>แผนก</label>
                        <input value={draft.department} onChange={(event) => update('department', event.target.value)} />
                    </div>
                    <div>
                        <label>บทบาท</label>
                        <select
                            value={draft.role}
                            onChange={(event) => update('role', event.target.value as AppEmployee['role'])}
                        >
                            <option value="Employee">Employee</option>
                            <option value="Supervisor">Supervisor</option>
                        </select>
                    </div>
                    <div>
                        <label>สถานะ</label>
                        <select
                            value={draft.status}
                            onChange={(event) => update('status', event.target.value as AppEmployee['status'])}
                        >
                            <option value="Active">Active</option>
                            <option value="OnLeave">OnLeave</option>
                            <option value="Resigned">Resigned</option>
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
                        <label>บทบาท</label>
                        <input value={employee.role} readOnly />
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
    const { employees, saveEmployee, saveEmployees, deleteEmployee } = useAppEmployees();

    const [query, setQuery] = useState('');
    const [editorState, setEditorState] = useState<AppEmployee | null>(null);
    const [viewerState, setViewerState] = useState<AppEmployee | null>(null);
    const [bulkCreateRange, setBulkCreateRange] = useState('');
    const [bulkCreateNotice, setBulkCreateNotice] = useState('');
    const [bulkCreating, setBulkCreating] = useState(false);

    const filtered = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) {
            return employees;
        }

        return employees.filter((employee) => {
            const fullName = `${employee.firstNameTH} ${employee.lastNameTH} ${employee.firstNameEN} ${employee.lastNameEN}`.toLowerCase();
            return employee.id.toLowerCase().includes(normalized) || fullName.includes(normalized);
        });
    }, [employees, query]);

    const exportCsv = () => {
        const rows = filtered.map((employee) => ({
            id: employee.id,
            name_th: `${employee.firstNameTH} ${employee.lastNameTH}`,
            name_en: `${employee.firstNameEN} ${employee.lastNameEN}`,
            role: employee.role,
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
        const rangeResult = getEmployeeIdsFromRange(bulkCreateRange);
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
            const items = rangeResult.ids.map((id) => createNewEmployee(id));
            await saveEmployees(items);
            setBulkCreateNotice(`สร้างพนักงาน ${items.length} คนเรียบร้อย (PIN อัตโนมัติ 111111)`);
            setBulkCreateRange('');
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
                            onClick={() => setEditorState(createNewEmployee(getNextEmployeeId(employees)))}
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
                        <input
                            value={bulkCreateRange}
                            onChange={(event) => setBulkCreateRange(event.target.value.toUpperCase())}
                            placeholder="CR001-CR020"
                        />
                        <div className="panel-muted">รูปแบบ: รหัสเริ่ม-รหัสสิ้นสุด เช่น CR001-CR020</div>
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
            </section>

            <section className="panel table-panel">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>รหัส</th>
                                <th>ชื่อ</th>
                                <th>บทบาท</th>
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
                                        <strong>{employee.firstNameTH} {employee.lastNameTH}</strong>
                                        <div className="panel-muted">{employee.firstNameEN} {employee.lastNameEN}</div>
                                    </td>
                                    <td>{employee.role}</td>
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
