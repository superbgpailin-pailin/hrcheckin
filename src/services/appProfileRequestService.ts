import { supabase } from '../lib/supabaseClient';
import type {
    AppEmployee,
    EmployeeProfileDraft,
    EmployeeProfileRequest,
    EmployeeProfileRequestStatus,
    EmployeeProfileRequestType,
} from '../types/app';
import { appEmployeeService } from './appEmployeeService';

interface ProfileRequestRow {
    id: string;
    employee_id: string;
    pin: string;
    first_name_th: string | null;
    last_name_th: string | null;
    first_name_en: string | null;
    last_name_en: string | null;
    nickname: string | null;
    position: string | null;
    department: string | null;
    email: string | null;
    phone_number: string | null;
    birth_date: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    selfie_url: string | null;
    id_card_url: string | null;
    passport_url: string | null;
    start_date: string | null;
    default_shift_id: string | null;
    request_type: EmployeeProfileRequestType | null;
    status: EmployeeProfileRequestStatus | null;
    review_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string | null;
    updated_at: string | null;
}

interface EmployeeRow {
    id: string;
    role: string | null;
    status: string | null;
    photo_url: string | null;
}

const tableName = 'employee_profile_requests';
const employeesTable = 'employees';
const localStorageKey = 'hrcheckin_profile_requests_local_v1';
const unknownEmployeeMessage = 'ไม่พบรหัสพนักงานนี้ กรุณาติดต่อแอดมิน';
let profileRequestTableUnavailable = false;

const normalizeEmployeeId = (value: string): string => value.trim().toUpperCase();

const toDraft = (row: ProfileRequestRow): EmployeeProfileDraft => {
    return {
        employeeId: row.employee_id,
        pin: row.pin,
        firstNameTH: row.first_name_th || '',
        lastNameTH: row.last_name_th || '',
        firstNameEN: row.first_name_en || '',
        lastNameEN: row.last_name_en || '',
        nickname: row.nickname || '',
        position: row.position || '',
        department: row.department || '',
        email: row.email || '',
        phoneNumber: row.phone_number || '',
        birthDate: row.birth_date || '',
        emergencyContactName: row.emergency_contact_name || '',
        emergencyContactPhone: row.emergency_contact_phone || '',
        selfieUrl: row.selfie_url || '',
        idCardUrl: row.id_card_url || '',
        passportUrl: row.passport_url || '',
        startDate: row.start_date || new Date().toISOString().slice(0, 10),
    };
};

const toProfileRequest = (row: ProfileRequestRow): EmployeeProfileRequest => {
    return {
        ...toDraft(row),
        id: row.id,
        requestType: row.request_type || 'update',
        status: row.status || 'pending',
        reviewNote: row.review_note || '',
        reviewedBy: row.reviewed_by || '',
        reviewedAt: row.reviewed_at || '',
        createdAt: row.created_at || '',
        updatedAt: row.updated_at || '',
    };
};

const loadExistingEmployee = async (employeeId: string): Promise<EmployeeRow | null> => {
    try {
        const { data, error } = await supabase
            .from(employeesTable)
            .select('id, role, status, photo_url')
            .eq('id', employeeId)
            .maybeSingle();

        if (error) {
            throw new Error(error.message);
        }

        return (data as EmployeeRow | null) || null;
    } catch {
        const employee = await appEmployeeService.getEmployeeById(employeeId);
        if (!employee) {
            return null;
        }

        return {
            id: employee.id,
            role: employee.role,
            status: employee.status,
            photo_url: employee.photoUrl,
        };
    }
};

const avatarForEmployee = (draft: EmployeeProfileDraft): string => {
    const label = `${draft.firstNameEN} ${draft.lastNameEN}`.trim() || draft.employeeId;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=334155&color=fff`;
};

const roleFromEmployeeRow = (row: EmployeeRow | null): AppEmployee['role'] => {
    if (!row) {
        return 'Employee';
    }

    return (row.role || 'Employee') as AppEmployee['role'];
};

const statusFromEmployeeRow = (row: EmployeeRow | null): AppEmployee['status'] => {
    if (!row) {
        return 'Active';
    }

    return (row.status || 'Active') as AppEmployee['status'];
};

const validateDraft = (draft: EmployeeProfileDraft): void => {
    if (!normalizeEmployeeId(draft.employeeId)) {
        throw new Error('กรุณากรอกรหัสพนักงาน');
    }

    const pin = draft.pin.replace(/\D/g, '');
    if (pin.length < 4) {
        throw new Error('PIN ต้องอย่างน้อย 4 หลัก');
    }

    if (!draft.firstNameTH.trim() || !draft.lastNameTH.trim()) {
        throw new Error('กรุณากรอกชื่อและนามสกุล');
    }

    if (!draft.birthDate) {
        throw new Error('กรุณากรอกวันเดือนปีเกิด');
    }

    if (!draft.emergencyContactName.trim() || !draft.emergencyContactPhone.trim()) {
        throw new Error('กรุณากรอกผู้ติดต่อฉุกเฉินและเบอร์โทรฉุกเฉิน');
    }

    if (!draft.selfieUrl || !draft.idCardUrl || !draft.passportUrl) {
        throw new Error('กรุณาอัปโหลดรูปตัวเอง รูปบัตรประชาชน และรูปพาสปอร์ต');
    }
};

const isMissingTableError = (errorMessage: string): boolean => {
    const message = errorMessage.toLowerCase();
    return message.includes('could not find the table') || message.includes('schema cache') || message.includes('does not exist');
};

const markProfileRequestTableUnavailable = (errorMessage: string): boolean => {
    if (!isMissingTableError(errorMessage)) {
        return false;
    }
    profileRequestTableUnavailable = true;
    return true;
};

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'object' && error && 'message' in error) {
        return String((error as { message?: unknown }).message || '');
    }

    return String(error || '');
};

const readLocalRequests = (): EmployeeProfileRequest[] => {
    try {
        const raw = localStorage.getItem(localStorageKey);
        if (!raw) {
            return [];
        }
        return JSON.parse(raw) as EmployeeProfileRequest[];
    } catch {
        return [];
    }
};

const writeLocalRequests = (rows: EmployeeProfileRequest[]): void => {
    localStorage.setItem(localStorageKey, JSON.stringify(rows));
};

const pendingExistsInLocal = (employeeId: string): boolean => {
    return readLocalRequests().some((row) => row.employeeId === employeeId && row.status === 'pending');
};

const createLocalRequest = (
    draft: EmployeeProfileDraft,
    requestType: EmployeeProfileRequestType,
): EmployeeProfileRequest => {
    const now = new Date().toISOString();
    return {
        ...draft,
        employeeId: normalizeEmployeeId(draft.employeeId),
        id: `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        requestType,
        status: 'pending',
        reviewNote: '',
        reviewedBy: '',
        reviewedAt: '',
        createdAt: now,
        updatedAt: now,
    };
};

const listLocalRequestsByStatus = (status: EmployeeProfileRequestStatus | 'all'): EmployeeProfileRequest[] => {
    const rows = readLocalRequests();
    if (status === 'all') {
        return rows;
    }
    return rows.filter((row) => row.status === status);
};

const createPendingLocalRequest = (
    draft: EmployeeProfileDraft,
    requestType: EmployeeProfileRequestType,
): { id: string; requestType: EmployeeProfileRequestType } => {
    const employeeId = normalizeEmployeeId(draft.employeeId);
    if (pendingExistsInLocal(employeeId)) {
        throw new Error('รหัสพนักงานนี้มีคำขอรออนุมัติอยู่แล้ว');
    }
    const localRequest = createLocalRequest(draft, requestType);
    writeLocalRequests([localRequest, ...readLocalRequests()]);
    return { id: localRequest.id, requestType };
};

const approveLocalRequest = async (requestId: string, reviewedBy: string): Promise<void> => {
    const localRows = readLocalRequests();
    const target = localRows.find((row) => row.id === requestId);
    if (!target) {
        throw new Error('ไม่พบคำขอที่ต้องการอนุมัติ');
    }
    if (target.status !== 'pending') {
        throw new Error('คำขอนี้ถูกดำเนินการแล้ว');
    }

    const existing = await loadExistingEmployee(target.employeeId);
    const employee: AppEmployee = {
        id: target.employeeId,
        role: roleFromEmployeeRow(existing),
        firstNameTH: target.firstNameTH,
        lastNameTH: target.lastNameTH,
        firstNameEN: target.firstNameEN,
        lastNameEN: target.lastNameEN,
        nickname: target.nickname || target.firstNameEN || target.employeeId,
        position: target.position,
        department: target.department,
        status: statusFromEmployeeRow(existing),
        photoUrl: existing?.photo_url || target.selfieUrl || avatarForEmployee(target),
        pin: target.pin,
        email: target.email,
        phoneNumber: target.phoneNumber,
        birthDate: target.birthDate,
        emergencyContactName: target.emergencyContactName,
        emergencyContactPhone: target.emergencyContactPhone,
        selfieUrl: target.selfieUrl,
        idCardUrl: target.idCardUrl,
        passportUrl: target.passportUrl,
        startDate: target.startDate,
        defaultShiftId: undefined,
    };

    await appEmployeeService.upsertEmployee(employee);

    const now = new Date().toISOString();
    const next = localRows.map((row) => {
        if (row.id !== requestId) {
            return row;
        }
        return {
            ...row,
            status: 'approved' as EmployeeProfileRequestStatus,
            reviewedBy,
            reviewedAt: now,
            reviewNote: '',
            updatedAt: now,
        };
    });
    writeLocalRequests(next);
};

const rejectLocalRequest = (requestId: string, reviewedBy: string, reviewNote: string): void => {
    const localRows = readLocalRequests();
    const now = new Date().toISOString();
    const next = localRows.map((row) => {
        if (row.id !== requestId) {
            return row;
        }
        return {
            ...row,
            status: 'rejected' as EmployeeProfileRequestStatus,
            reviewedBy,
            reviewedAt: now,
            reviewNote: reviewNote.trim(),
            updatedAt: now,
        };
    });
    writeLocalRequests(next);
};

const toPayload = (draft: EmployeeProfileDraft, requestType: EmployeeProfileRequestType): Record<string, string | null> => {
    return {
        employee_id: normalizeEmployeeId(draft.employeeId),
        pin: draft.pin.replace(/\D/g, '').slice(0, 6),
        first_name_th: draft.firstNameTH.trim(),
        last_name_th: draft.lastNameTH.trim(),
        first_name_en: draft.firstNameEN.trim(),
        last_name_en: draft.lastNameEN.trim(),
        nickname: draft.nickname.trim(),
        position: draft.position.trim(),
        department: draft.department.trim(),
        email: draft.email.trim(),
        phone_number: draft.phoneNumber.trim(),
        birth_date: draft.birthDate,
        emergency_contact_name: draft.emergencyContactName.trim(),
        emergency_contact_phone: draft.emergencyContactPhone.trim(),
        selfie_url: draft.selfieUrl,
        id_card_url: draft.idCardUrl,
        passport_url: draft.passportUrl,
        start_date: draft.startDate,
        default_shift_id: null,
        request_type: requestType,
        status: 'pending',
        review_note: '',
    };
};

const insertRequest = async (payload: Record<string, string | null>): Promise<{ id?: string }> => {
    const fullInsert = await supabase
        .from(tableName)
        .insert([payload])
        .select('id')
        .single();

    if (!fullInsert.error) {
        return fullInsert.data as { id?: string };
    }

    if (!isMissingTableError(fullInsert.error.message)) {
        throw new Error(fullInsert.error.message);
    }

    throw fullInsert.error;
};

export const appProfileRequestService = {
    async submitRequest(draft: EmployeeProfileDraft): Promise<{ id: string; requestType: EmployeeProfileRequestType }> {
        validateDraft(draft);

        const employeeId = normalizeEmployeeId(draft.employeeId);
        const existing = await loadExistingEmployee(employeeId);
        if (!existing) {
            throw new Error(unknownEmployeeMessage);
        }
        const requestType: EmployeeProfileRequestType = 'update';

        if (profileRequestTableUnavailable) {
            return createPendingLocalRequest(draft, requestType);
        }

        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('id')
                .eq('employee_id', employeeId)
                .eq('status', 'pending')
                .limit(1);

            if (error) {
                if (!isMissingTableError(error.message)) {
                    throw new Error(error.message);
                }
                throw error;
            }

            if ((data as Array<{ id: string }> | null)?.length) {
                throw new Error('รหัสพนักงานนี้มีคำขอรออนุมัติอยู่แล้ว');
            }

            const inserted = await insertRequest(toPayload(draft, requestType));
            return { id: String(inserted.id || ''), requestType };
        } catch (error) {
            const message = getErrorMessage(error);
            if (!markProfileRequestTableUnavailable(message)) {
                throw (error instanceof Error ? error : new Error(message || 'ไม่สามารถส่งคำขอได้'));
            }
            return createPendingLocalRequest(draft, requestType);
        }
    },

    async listRequests(status: EmployeeProfileRequestStatus | 'all' = 'all'): Promise<EmployeeProfileRequest[]> {
        if (profileRequestTableUnavailable) {
            return listLocalRequestsByStatus(status);
        }

        try {
            let query = supabase
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false });

            if (status !== 'all') {
                query = query.eq('status', status);
            }

            const { data, error } = await query;
            if (error) {
                throw error;
            }

            return ((data as ProfileRequestRow[]) || []).map(toProfileRequest);
        } catch (error) {
            const message = getErrorMessage(error);
            if (!markProfileRequestTableUnavailable(message)) {
                throw (error instanceof Error ? error : new Error(message || 'ไม่สามารถโหลดคำขอได้'));
            }
            return listLocalRequestsByStatus(status);
        }
    },

    async approveRequest(requestId: string, reviewedBy: string): Promise<void> {
        if (profileRequestTableUnavailable) {
            await approveLocalRequest(requestId, reviewedBy);
            return;
        }

        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .eq('id', requestId)
                .single();

            if (error) {
                throw error;
            }

            const row = data as ProfileRequestRow;
            if ((row.status || 'pending') !== 'pending') {
                throw new Error('คำขอนี้ถูกดำเนินการแล้ว');
            }

            const draft = toDraft(row);
            const existing = await loadExistingEmployee(draft.employeeId);

            const employee: AppEmployee = {
                id: draft.employeeId,
                role: roleFromEmployeeRow(existing),
                firstNameTH: draft.firstNameTH,
                lastNameTH: draft.lastNameTH,
                firstNameEN: draft.firstNameEN,
                lastNameEN: draft.lastNameEN,
                nickname: draft.nickname || draft.firstNameEN || draft.employeeId,
                position: draft.position,
                department: draft.department,
                status: statusFromEmployeeRow(existing),
                photoUrl: existing?.photo_url || draft.selfieUrl || avatarForEmployee(draft),
                pin: draft.pin,
                email: draft.email,
                phoneNumber: draft.phoneNumber,
                birthDate: draft.birthDate,
                emergencyContactName: draft.emergencyContactName,
                emergencyContactPhone: draft.emergencyContactPhone,
                selfieUrl: draft.selfieUrl,
                idCardUrl: draft.idCardUrl,
                passportUrl: draft.passportUrl,
                startDate: draft.startDate,
                defaultShiftId: undefined,
            };

            await appEmployeeService.upsertEmployee(employee);

            const { error: updateError } = await supabase
                .from(tableName)
                .update({
                    status: 'approved',
                    reviewed_by: reviewedBy,
                    reviewed_at: new Date().toISOString(),
                    review_note: '',
                })
                .eq('id', requestId);

            if (updateError) {
                throw new Error(updateError.message);
            }
        } catch (error) {
            const message = getErrorMessage(error);
            if (!markProfileRequestTableUnavailable(message)) {
                throw (error instanceof Error ? error : new Error(message || 'ไม่สามารถอนุมัติคำขอได้'));
            }
            await approveLocalRequest(requestId, reviewedBy);
        }
    },

    async rejectRequest(requestId: string, reviewedBy: string, reviewNote: string): Promise<void> {
        if (profileRequestTableUnavailable) {
            rejectLocalRequest(requestId, reviewedBy, reviewNote);
            return;
        }

        try {
            const { error } = await supabase
                .from(tableName)
                .update({
                    status: 'rejected',
                    reviewed_by: reviewedBy,
                    reviewed_at: new Date().toISOString(),
                    review_note: reviewNote.trim(),
                })
                .eq('id', requestId);

            if (error) {
                throw error;
            }
        } catch (error) {
            const message = getErrorMessage(error);
            if (!markProfileRequestTableUnavailable(message)) {
                throw (error instanceof Error ? error : new Error(message || 'ไม่สามารถปฏิเสธคำขอได้'));
            }
            rejectLocalRequest(requestId, reviewedBy, reviewNote);
        }
    },
};
