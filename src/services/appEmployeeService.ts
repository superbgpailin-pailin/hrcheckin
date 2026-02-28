import { supabase } from '../lib/supabaseClient';
import type { AppEmployee } from '../types/app';
import { getErrorMessage, isTransportError, withReadRetry } from '../utils/supabaseUtils';

interface EmployeeRow {
    id: string;
    role: string | null;
    photo_url: string | null;
    first_name_th: string | null;
    last_name_th: string | null;
    first_name_en: string | null;
    last_name_en: string | null;
    nickname: string | null;
    position: string | null;
    department: string | null;
    status: string | null;
    pin: string | null;
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
}

type EmployeePayload = Record<string, string | null>;

const tableName = 'employees';
const BACKEND_UNAVAILABLE_MESSAGE = 'เซิร์ฟเวอร์ฐานข้อมูลตอบช้าหรือไม่พร้อมใช้งาน กรุณาลองใหม่';
const employeeSelectFields = [
    'id',
    'role',
    'photo_url',
    'first_name_th',
    'last_name_th',
    'first_name_en',
    'last_name_en',
    'nickname',
    'position',
    'department',
    'status',
    'pin',
    'email',
    'phone_number',
    'birth_date',
    'emergency_contact_name',
    'emergency_contact_phone',
    'selfie_url',
    'start_date',
    'default_shift_id',
].join(', ');
const legacyOptionalColumns = [
    'default_shift_id',
    'birth_date',
    'emergency_contact_name',
    'emergency_contact_phone',
    'selfie_url',
    'id_card_url',
    'passport_url',
];
const employeeCacheKeys = [
    'hrcheckin_employees_cache_v3',
    'hrcheckin_employees_cache_v2',
    'hrcheckin_employees_cache_v1',
];

const sanitizePin = (value: string): string => value.replace(/\D/g, '').slice(0, 6);
const normalizeEmployeeId = (value: string): string => value.trim().toUpperCase();

const buildEmployeeAvatar = (employeeId: string): string => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(employeeId)}&background=334155&color=fff`;
};

const readCachedEmployees = (): AppEmployee[] => {
    if (typeof localStorage === 'undefined') {
        return [];
    }

    for (const key of employeeCacheKeys) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) {
                continue;
            }

            const parsed = JSON.parse(raw) as Array<Partial<AppEmployee> & { id?: string }>;
            if (!Array.isArray(parsed)) {
                continue;
            }

            return parsed
                .filter((employee): employee is Partial<AppEmployee> & { id: string } => typeof employee.id === 'string' && employee.id.length > 0)
                .map((employee) => ({
                    id: employee.id,
                    role: normalizeEmployeeRole(typeof employee.role === 'string' ? employee.role : 'Employee'),
                    firstNameTH: String(employee.firstNameTH || '-'),
                    lastNameTH: String(employee.lastNameTH || '-'),
                    firstNameEN: String(employee.firstNameEN || '-'),
                    lastNameEN: String(employee.lastNameEN || '-'),
                    nickname: String(employee.nickname || employee.id),
                    position: String(employee.position || '-'),
                    department: String(employee.department || '-'),
                    status: normalizeEmployeeStatus(typeof employee.status === 'string' ? employee.status : 'Active'),
                    photoUrl: String(employee.photoUrl || buildEmployeeAvatar(employee.id)),
                    pin: String(employee.pin || '111111'),
                    email: String(employee.email || ''),
                    phoneNumber: String(employee.phoneNumber || ''),
                    birthDate: String(employee.birthDate || ''),
                    emergencyContactName: String(employee.emergencyContactName || ''),
                    emergencyContactPhone: String(employee.emergencyContactPhone || ''),
                    selfieUrl: String(employee.selfieUrl || ''),
                    idCardUrl: String(employee.idCardUrl || ''),
                    passportUrl: String(employee.passportUrl || ''),
                    startDate: String(employee.startDate || new Date().toISOString().slice(0, 10)),
                    defaultShiftId: employee.defaultShiftId as AppEmployee['defaultShiftId'],
                }));
        } catch {
            continue;
        }
    }

    return [];
};

const normalizeDateOrNull = (value: string | null | undefined): string | null => {
    const normalized = String(value || '').trim();
    return normalized || null;
};

const normalizeDateOrToday = (value: string | null | undefined): string => {
    const normalized = String(value || '').trim();
    return normalized || new Date().toISOString().slice(0, 10);
};

const normalizeEmployeeRole = (value: string | null | undefined): AppEmployee['role'] => {
    const normalized = String(value || '').trim().toLowerCase();
    if (
        normalized === 'supervisor'
        || normalized === 'head'
        || normalized === 'manager'
        || normalized === 'หัวหน้า'
        || normalized === 'หัวหน้างาน'
    ) {
        return 'Supervisor';
    }
    return 'Employee';
};

const normalizeEmployeeStatus = (value: string | null | undefined): AppEmployee['status'] => {
    const normalized = String(value || '').trim().toLowerCase();
    if (
        normalized === 'onleave'
        || normalized === 'on leave'
        || normalized === 'leave'
        || normalized === 'ลา'
        || normalized === 'ลางาน'
        || normalized === 'ลาพัก'
    ) {
        return 'OnLeave';
    }
    if (
        normalized === 'resigned'
        || normalized === 'ลาออก'
        || normalized === 'พ้นสภาพ'
        || normalized === 'ยกเลิก'
    ) {
        return 'Resigned';
    }
    return 'Active';
};

const toAppEmployee = (row: EmployeeRow): AppEmployee => {
    const role = normalizeEmployeeRole(row.role);
    const fallbackPhoto = buildEmployeeAvatar(row.id);

    return {
        id: row.id,
        role,
        firstNameTH: row.first_name_th || '-',
        lastNameTH: row.last_name_th || '-',
        firstNameEN: row.first_name_en || '-',
        lastNameEN: row.last_name_en || '-',
        nickname: row.nickname || row.first_name_en || row.id,
        position: row.position || '-',
        department: row.department || '-',
        status: normalizeEmployeeStatus(row.status),
        photoUrl: row.photo_url || fallbackPhoto,
        pin: row.pin || '111111',
        email: row.email || '',
        phoneNumber: row.phone_number || '',
        birthDate: row.birth_date || '',
        emergencyContactName: row.emergency_contact_name || '',
        emergencyContactPhone: row.emergency_contact_phone || '',
        selfieUrl: row.selfie_url || row.photo_url || fallbackPhoto,
        idCardUrl: row.id_card_url || '',
        passportUrl: row.passport_url || '',
        startDate: row.start_date || new Date().toISOString().slice(0, 10),
        defaultShiftId: row.default_shift_id as AppEmployee['defaultShiftId'],
    };
};

const toPayload = (employee: AppEmployee): EmployeePayload => {
    const payload: EmployeePayload = {
        id: employee.id.trim().toUpperCase(),
        role: normalizeEmployeeRole(employee.role),
        first_name_th: employee.firstNameTH,
        last_name_th: employee.lastNameTH,
        first_name_en: employee.firstNameEN,
        last_name_en: employee.lastNameEN,
        nickname: employee.nickname,
        position: employee.position,
        department: employee.department,
        status: normalizeEmployeeStatus(employee.status),
        pin: employee.pin,
        email: employee.email,
        phone_number: employee.phoneNumber,
        birth_date: normalizeDateOrNull(employee.birthDate),
        emergency_contact_name: employee.emergencyContactName,
        emergency_contact_phone: employee.emergencyContactPhone,
        start_date: normalizeDateOrToday(employee.startDate),
        default_shift_id: employee.defaultShiftId || null,
    };

    const normalizedPhoto = employee.photoUrl.trim();
    if (normalizedPhoto && !normalizedPhoto.includes('ui-avatars.com/api')) {
        payload.photo_url = normalizedPhoto;
    }

    if (employee.selfieUrl.trim()) {
        payload.selfie_url = employee.selfieUrl.trim();
    }

    if (employee.idCardUrl.trim()) {
        payload.id_card_url = employee.idCardUrl.trim();
    }

    if (employee.passportUrl.trim()) {
        payload.passport_url = employee.passportUrl.trim();
    }

    return payload;
};

const withoutKey = (source: EmployeePayload, key: string): EmployeePayload => {
    const { [key]: ignored, ...rest } = source;
    void ignored;
    return rest;
};

const extractMissingColumn = (message: string): string | null => {
    const match = message.toLowerCase().match(/'([a-z0-9_]+)' column/);
    return match?.[1] || null;
};

const removeColumnsByMessage = (
    source: EmployeePayload,
    message: string,
): { nextPayload: EmployeePayload; removedAny: boolean } => {
    let nextPayload = { ...source };
    let removedAny = false;
    const normalizedMessage = message.toLowerCase();

    legacyOptionalColumns.forEach((column) => {
        if (normalizedMessage.includes(column) && column in nextPayload) {
            nextPayload = withoutKey(nextPayload, column);
            removedAny = true;
        }
    });

    const discoveredColumn = extractMissingColumn(normalizedMessage);
    if (discoveredColumn && discoveredColumn in nextPayload) {
        nextPayload = withoutKey(nextPayload, discoveredColumn);
        removedAny = true;
    }

    return { nextPayload, removedAny };
};

const retryUpsertWithLegacyPayload = async (payload: EmployeePayload, message: string): Promise<void> => {
    let fallbackPayload = { ...payload };
    let lastMessage = message;

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const { nextPayload, removedAny } = removeColumnsByMessage(fallbackPayload, lastMessage);
        if (!removedAny) {
            throw new Error(lastMessage);
        }

        fallbackPayload = nextPayload;
        const { error } = await supabase.from(tableName).upsert(fallbackPayload);
        if (!error) {
            return;
        }

        lastMessage = error.message;
    }

    throw new Error(lastMessage);
};

const retryBulkUpsertWithLegacyPayload = async (payloads: EmployeePayload[], message: string): Promise<void> => {
    let fallbackPayloads = [...payloads];
    let lastMessage = message;

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const nextPayloads = fallbackPayloads.map((payload) => removeColumnsByMessage(payload, lastMessage).nextPayload);
        const changed = nextPayloads.some((payload, index) => Object.keys(payload).length !== Object.keys(fallbackPayloads[index]).length);
        if (!changed) {
            throw new Error(lastMessage);
        }

        fallbackPayloads = nextPayloads;
        const { error } = await supabase.from(tableName).upsert(fallbackPayloads);
        if (!error) {
            return;
        }

        lastMessage = error.message;
    }

    throw new Error(lastMessage);
};

const updateEmployeeReferenceColumn = async (
    table: string,
    column: string,
    previousId: string,
    nextId: string,
): Promise<void> => {
    const { error } = await supabase
        .from(table)
        .update({ [column]: nextId })
        .eq(column, previousId);

    if (error) {
        const message = getErrorMessage(error).toLowerCase();
        if (
            message.includes('does not exist')
            || message.includes('schema cache')
            || message.includes('could not find the table')
            || message.includes('permission denied')
        ) {
            return;
        }
        throw new Error(getErrorMessage(error));
    }
};

const renameEmployeeRelations = async (previousId: string, nextId: string): Promise<void> => {
    if (!previousId || previousId === nextId) {
        return;
    }

    await updateEmployeeReferenceColumn('attendance', 'employee_id', previousId, nextId).catch(() => undefined);
    await updateEmployeeReferenceColumn('attendance', 'user_id', previousId, nextId).catch(() => undefined);
    await updateEmployeeReferenceColumn('employee_profile_requests', 'employee_id', previousId, nextId).catch(() => undefined);
};

export const appEmployeeService = {
    async getEmployees(): Promise<AppEmployee[]> {
        try {
            const { data, error } = await withReadRetry(async () => {
                return await supabase
                    .from(tableName)
                    .select(employeeSelectFields)
                    .order('id', { ascending: true });
            });

            if (error) {
                throw error;
            }

            const rows = (data as unknown as EmployeeRow[]) || [];
            return rows.map(toAppEmployee);
        } catch (error) {
            const message = getErrorMessage(error);
            const cachedEmployees = readCachedEmployees();
            if (cachedEmployees.length > 0) {
                return cachedEmployees.sort((a, b) => a.id.localeCompare(b.id));
            }
            if (isTransportError(message)) {
                throw new Error(BACKEND_UNAVAILABLE_MESSAGE);
            }
            throw new Error(message || 'ไม่สามารถโหลดรายชื่อพนักงานได้');
        }
    },

    async upsertEmployee(employee: AppEmployee, previousId = employee.id): Promise<void> {
        const payload = toPayload(employee);
        const normalizedNextId = normalizeEmployeeId(employee.id);
        const normalizedPreviousId = normalizeEmployeeId(previousId);

        try {
            const { error } = await supabase.from(tableName).upsert(payload);
            if (error) {
                await retryUpsertWithLegacyPayload(payload, error.message);
            }

            if (normalizedPreviousId && normalizedPreviousId !== normalizedNextId) {
                await renameEmployeeRelations(normalizedPreviousId, normalizedNextId);

                const { error: deleteError } = await supabase
                    .from(tableName)
                    .delete()
                    .eq('id', normalizedPreviousId);

                if (deleteError) {
                    throw deleteError;
                }
            }
        } catch (error) {
            const message = getErrorMessage(error);
            if (isTransportError(message)) {
                throw new Error('ไม่สามารถบันทึกข้อมูลพนักงานได้ กรุณาลองใหม่');
            }
            throw new Error(message || 'ไม่สามารถบันทึกข้อมูลพนักงานได้');
        }
    },

    async upsertEmployees(items: AppEmployee[]): Promise<void> {
        if (!items.length) {
            return;
        }

        const payloads = items.map(toPayload);
        try {
            const { error } = await supabase.from(tableName).upsert(payloads);
            if (!error) {
                return;
            }

            await retryBulkUpsertWithLegacyPayload(payloads, error.message);
        } catch (error) {
            const message = getErrorMessage(error);
            if (isTransportError(message)) {
                throw new Error('ไม่สามารถบันทึกข้อมูลพนักงานได้ กรุณาลองใหม่');
            }
            throw new Error(message || 'ไม่สามารถบันทึกข้อมูลพนักงานได้');
        }
    },

    async getEmployeeById(id: string): Promise<AppEmployee | null> {
        const normalized = id.trim().toUpperCase();
        if (!normalized) {
            return null;
        }

        const cachedEmployee = readCachedEmployees().find((employee) => employee.id.trim().toUpperCase() === normalized);

        try {
            const { data, error } = await withReadRetry(async () => {
                return await supabase
                    .from(tableName)
                    .select(employeeSelectFields)
                    .eq('id', normalized)
                    .maybeSingle();
            });

            if (error) {
                throw error;
            }

            if (!data) {
                return null;
            }

            return toAppEmployee(data as unknown as EmployeeRow);
        } catch (error) {
            if (cachedEmployee) {
                return cachedEmployee;
            }

            const message = getErrorMessage(error);
            if (isTransportError(message)) {
                throw new Error(BACKEND_UNAVAILABLE_MESSAGE);
            }
            throw new Error(message);
        }
    },

    async verifyEmployeePin(id: string, pin: string): Promise<AppEmployee> {
        const normalized = id.trim().toUpperCase();
        const sanitizedPin = sanitizePin(pin);

        if (!normalized) {
            throw new Error('กรุณาระบุรหัสพนักงาน');
        }
        if (sanitizedPin.length < 4) {
            throw new Error('กรุณากรอก PIN เดิมให้ถูกต้อง');
        }

        const employee = await appEmployeeService.getEmployeeById(normalized);
        if (!employee) {
            throw new Error('ไม่พบรหัสพนักงานนี้ กรุณาติดต่อแอดมิน');
        }

        const currentPin = sanitizePin(employee.pin || '111111');
        if (currentPin !== sanitizedPin) {
            throw new Error('PIN เดิมไม่ถูกต้อง หากจำ PIN ไม่ได้ให้ติดต่อแอดมิน');
        }

        return employee;
    },

    async changeEmployeePin(id: string, currentPin: string, newPin: string): Promise<void> {
        const normalized = id.trim().toUpperCase();
        const sanitizedNewPin = sanitizePin(newPin);

        if (sanitizedNewPin.length < 4) {
            throw new Error('PIN ใหม่ต้องมีอย่างน้อย 4 หลัก');
        }

        await appEmployeeService.verifyEmployeePin(normalized, currentPin);
        await appEmployeeService.updateEmployeePin(normalized, sanitizedNewPin);
    },

    async updateEmployeePin(id: string, pin: string): Promise<void> {
        const normalized = id.trim().toUpperCase();
        const sanitizedPin = sanitizePin(pin);

        if (!normalized) {
            throw new Error('กรุณาระบุรหัสพนักงาน');
        }
        if (sanitizedPin.length < 4) {
            throw new Error('PIN ต้องมีอย่างน้อย 4 หลัก');
        }

        const { data, error } = await supabase
            .from(tableName)
            .update({ pin: sanitizedPin })
            .eq('id', normalized)
            .select('id')
            .maybeSingle();

        if (error) {
            throw new Error(getErrorMessage(error));
        }

        if (!data) {
            throw new Error('ไม่พบรหัสพนักงานนี้ กรุณาติดต่อแอดมิน');
        }
    },

    async deleteEmployee(id: string): Promise<void> {
        const { error } = await supabase.from(tableName).delete().eq('id', normalizeEmployeeId(id));
        if (error) {
            throw new Error(getErrorMessage(error));
        }
    },
};
