import { supabase } from '../lib/supabaseClient';
import { DEFAULT_SHIFTS } from '../data/appDefaults';
import type { AppEmployee, AttendanceSummaryRecord, ShiftDefinition } from '../types/app';
import { dayKey, estimatedCheckoutAt, lateMinutesForCheckIn } from '../utils/shiftUtils';

const tableName = 'attendance';
const attendanceSelectColumns = [
    'id',
    'employee_id',
    'user_id',
    'timestamp',
    'check_in_time',
    'created_at',
    'status',
    'shift_name',
    'shift',
    'site_id',
    'site',
    'kiosk_id',
    'type',
    'attendance_type',
    'photo_url',
];
const duplicateCheckInMessage = 'วันนี้เช็คอินแล้ว';
const saveFailedMessage = 'บันทึกเช็คอินไม่สำเร็จบนเซิร์ฟเวอร์ กรุณาลองใหม่หรือติดต่อแอดมิน';

interface AttendanceRow {
    id?: string | null;
    employee_id?: string | null;
    user_id?: string | null;
    timestamp?: string | null;
    check_in_time?: string | null;
    created_at?: string | null;
    status?: string | null;
    shift_name?: string | null;
    shift?: string | null;
    site_id?: string | null;
    site?: string | null;
    kiosk_id?: string | null;
    type?: string | null;
    attendance_type?: string | null;
    photo_url?: string | null;
}

interface NormalizedAttendanceRow {
    id: string;
    employee_id: string;
    timestamp: string;
    status: 'On Time' | 'Late' | null;
    shift_name: string | null;
    site_id: string | null;
    type: 'check_in' | 'check_out' | null;
    photo_url: string | null;
}

interface AttendanceFilters {
    from?: string;
    to?: string;
    employeeId?: string;
}

interface AttendanceLoadOptions {
    useCache?: boolean;
}

interface AttendanceCacheEntry {
    savedAt: number;
    rows: NormalizedAttendanceRow[];
}

const optionalInsertColumns = [
    'user_id',
    'site_name',
    'site',
    'kiosk_id',
    'lat',
    'lng',
    'photo_url',
    'type',
    'attendance_type',
    'status',
    'shift_name',
    'shift',
    'site_id',
    'timestamp',
    'check_in_time',
];

const ATTENDANCE_CACHE_PREFIX = 'hrcheckin_attendance_cache_v1';
const ATTENDANCE_CACHE_TTL_MS = 30 * 1000;
const ATTENDANCE_SELECT_COLUMNS_CACHE_KEY = 'hrcheckin_attendance_select_columns_v1';
let resolvedAttendanceSelectColumns = [...attendanceSelectColumns];

const attendanceCacheKey = (filters: AttendanceFilters): string => {
    return [
        ATTENDANCE_CACHE_PREFIX,
        filters.from || '*',
        filters.to || '*',
        filters.employeeId || '*',
    ].join(':');
};

const readAttendanceCache = (filters: AttendanceFilters): NormalizedAttendanceRow[] | null => {
    try {
        const raw = localStorage.getItem(attendanceCacheKey(filters));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as AttendanceCacheEntry;
        if (!parsed?.savedAt || !Array.isArray(parsed.rows)) {
            return null;
        }

        if (Date.now() - parsed.savedAt > ATTENDANCE_CACHE_TTL_MS) {
            localStorage.removeItem(attendanceCacheKey(filters));
            return null;
        }

        return parsed.rows;
    } catch {
        return null;
    }
};

const readAttendanceSelectColumnsCache = (): string[] | null => {
    try {
        const raw = localStorage.getItem(ATTENDANCE_SELECT_COLUMNS_CACHE_KEY);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as string[];
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return null;
        }

        return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
    } catch {
        return null;
    }
};

const writeAttendanceSelectColumnsCache = (columns: string[]): void => {
    resolvedAttendanceSelectColumns = [...columns];

    try {
        localStorage.setItem(ATTENDANCE_SELECT_COLUMNS_CACHE_KEY, JSON.stringify(columns));
    } catch {
        // Ignore cache write failures. Query will still work with the in-memory list.
    }
};

const writeAttendanceCache = (filters: AttendanceFilters, rows: NormalizedAttendanceRow[]): void => {
    const entry: AttendanceCacheEntry = {
        savedAt: Date.now(),
        rows,
    };
    try {
        localStorage.setItem(attendanceCacheKey(filters), JSON.stringify(entry));
    } catch {
        // Ignore cache write failures. The live query result is already available.
    }
};

const clearAttendanceCache = (): void => {
    const keysToDelete: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(ATTENDANCE_CACHE_PREFIX)) {
            keysToDelete.push(key);
        }
    }
    keysToDelete.forEach((key) => localStorage.removeItem(key));
};

const asText = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'number') {
        return String(value);
    }
    return '';
};

const toIsoString = (value: unknown): string => {
    const raw = asText(value);
    if (!raw) {
        return new Date().toISOString();
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return new Date().toISOString();
    }
    return parsed.toISOString();
};

const normalizeStatus = (value: unknown): 'On Time' | 'Late' | null => {
    const normalized = asText(value).trim().toLowerCase();
    if (normalized === 'late') {
        return 'Late';
    }
    if (normalized === 'on time' || normalized === 'ontime') {
        return 'On Time';
    }
    return null;
};

const normalizeType = (value: unknown): 'check_in' | 'check_out' | null => {
    const normalized = asText(value).trim().toLowerCase();
    if (!normalized || normalized === 'check_in') {
        return 'check_in';
    }
    if (normalized === 'check_out') {
        return 'check_out';
    }
    return null;
};

const normalizeAttendanceRow = (row: AttendanceRow): NormalizedAttendanceRow => {
    const employeeId = asText(row.employee_id) || asText(row.user_id);
    const timestamp = toIsoString(row.timestamp || row.check_in_time || row.created_at);
    const shiftName = asText(row.shift_name) || asText(row.shift) || null;
    const siteId = asText(row.site_id) || asText(row.site) || asText(row.kiosk_id) || null;
    const type = normalizeType(row.type || row.attendance_type);
    const id = asText(row.id) || `ROW-${employeeId || 'UNKNOWN'}-${timestamp}`;

    return {
        id,
        employee_id: employeeId,
        timestamp,
        status: normalizeStatus(row.status),
        shift_name: shiftName,
        site_id: siteId,
        type,
        photo_url: asText(row.photo_url) || null,
    };
};

const withinFilters = (row: Pick<NormalizedAttendanceRow, 'employee_id' | 'timestamp'>, filters: AttendanceFilters): boolean => {
    if (filters.employeeId && row.employee_id !== filters.employeeId) {
        return false;
    }

    const date = dayKey(row.timestamp);
    if (filters.from && date < filters.from) {
        return false;
    }
    if (filters.to && date > filters.to) {
        return false;
    }

    return true;
};

const shiftByNameOrId = (nameOrId: string, shifts: ShiftDefinition[]): ShiftDefinition => {
    const source = shifts.length ? shifts : DEFAULT_SHIFTS;
    const normalized = nameOrId.trim().toLowerCase();
    const byId = source.find((shift) => shift.id.toLowerCase() === normalized);
    if (byId) {
        return byId;
    }

    const byLabel = source.find((shift) => shift.label.toLowerCase() === normalized);
    if (byLabel) {
        return byLabel;
    }

    return source[0];
};

const toSummary = (
    row: Pick<NormalizedAttendanceRow, 'id' | 'employee_id' | 'timestamp' | 'status' | 'shift_name' | 'site_id' | 'photo_url'>,
    shifts: ShiftDefinition[],
    employeeMap: Map<string, AppEmployee>,
    graceMinutes: number,
): AttendanceSummaryRecord => {
    const employee = employeeMap.get(row.employee_id);
    const shift = shiftByNameOrId(row.shift_name || '', shifts);
    const checkInAt = new Date(row.timestamp);
    const lateMinutes = lateMinutesForCheckIn(checkInAt, shift, graceMinutes);

    return {
        id: row.id,
        employeeId: row.employee_id,
        employeeName: employee
            ? `${employee.firstNameTH} ${employee.lastNameTH}`
            : row.employee_id,
        department: employee?.department || '-',
        role: employee?.role || 'Employee',
        shiftId: shift.id,
        shiftLabel: shift.label,
        checkInAt: row.timestamp,
        estimatedCheckOutAt: estimatedCheckoutAt(checkInAt, shift).toISOString(),
        lateMinutes,
        status: row.status || (lateMinutes > 0 ? 'Late' : 'On Time'),
        source: 'QR',
        kioskId: row.site_id || 'kiosk',
        photoUrl: row.photo_url || '',
    };
};

const dayKeyBangkok = (iso: string): string => {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

const hasDuplicateOnDay = (
    rows: Array<Pick<NormalizedAttendanceRow, 'employee_id' | 'timestamp' | 'type'>>,
    employeeId: string,
    checkInAtIso: string,
): boolean => {
    const targetDay = dayKeyBangkok(checkInAtIso);
    return rows.some((row) => {
        if (row.employee_id !== employeeId || row.type !== 'check_in') {
            return false;
        }
        return dayKeyBangkok(row.timestamp) === targetDay;
    });
};

const shouldRetryWithoutTimestampFilter = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('timestamp') && normalized.includes('column');
};

const removeMissingSelectColumn = (
    columns: string[],
    message: string,
): { nextColumns: string[]; removedAny: boolean } => {
    const discoveredColumn = extractMissingColumn(message);
    if (!discoveredColumn || !columns.includes(discoveredColumn)) {
        return { nextColumns: columns, removedAny: false };
    }

    return {
        nextColumns: columns.filter((column) => column !== discoveredColumn),
        removedAny: true,
    };
};

const loadRowsFromSupabase = async (
    filters: AttendanceFilters,
    options: AttendanceLoadOptions = {},
): Promise<NormalizedAttendanceRow[]> => {
    const useCache = options.useCache ?? true;
    const cachedSelectColumns = readAttendanceSelectColumnsCache();
    if (cachedSelectColumns?.length) {
        resolvedAttendanceSelectColumns = cachedSelectColumns;
    }

    if (useCache) {
        const cached = readAttendanceCache(filters);
        if (cached) {
            return cached;
        }
    }

    const queryRows = async (withTimestampFilter: boolean): Promise<AttendanceRow[]> => {
        let query = supabase
            .from(tableName)
            .select(selectColumns.join(', '))
            .order('timestamp', { ascending: false });

        if (filters.employeeId) {
            query = query.eq('employee_id', filters.employeeId);
        }

        if (withTimestampFilter && filters.from) {
            query = query.gte('timestamp', `${filters.from}T00:00:00`);
        }

        if (withTimestampFilter && filters.to) {
            query = query.lte('timestamp', `${filters.to}T23:59:59`);
        }

        const { data, error } = await query;
        if (error) {
            throw error;
        }

        return (data as AttendanceRow[]) || [];
    };

    let rows: AttendanceRow[] = [];
    let selectColumns = [...resolvedAttendanceSelectColumns];
    let withTimestampFilter = true;

    for (let attempt = 0; attempt < attendanceSelectColumns.length + 2; attempt += 1) {
        try {
            rows = await queryRows(withTimestampFilter);
            writeAttendanceSelectColumnsCache(selectColumns);
            break;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error || '');
            const selectFallback = removeMissingSelectColumn(selectColumns, message);

            if (selectFallback.removedAny && selectFallback.nextColumns.length > 0) {
                selectColumns = selectFallback.nextColumns;
                continue;
            }

            if (withTimestampFilter && shouldRetryWithoutTimestampFilter(message)) {
                withTimestampFilter = false;
                continue;
            }

            throw error;
        }
    }

    const normalizedRows = rows
        .map(normalizeAttendanceRow)
        .filter((row) => row.employee_id)
        .filter((row) => row.type !== 'check_out')
        .filter((row) => withinFilters(row, filters))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (useCache) {
        writeAttendanceCache(filters, normalizedRows);
    }

    return normalizedRows;
};

const extractMissingColumn = (message: string): string | null => {
    const match = message.toLowerCase().match(/['"`]([a-z0-9_]+)['"`]\s+column/);
    if (match?.[1]) {
        return match[1];
    }

    const fallback = message.toLowerCase().match(/column ['"`]?([a-z0-9_]+)['"`]?/);
    return fallback?.[1] || null;
};

const removeColumnsByMessage = (
    source: Record<string, string | number>,
    message: string,
): { nextPayload: Record<string, string | number>; removedAny: boolean } => {
    const normalized = message.toLowerCase();
    const nextPayload: Record<string, string | number> = { ...source };
    let removedAny = false;

    optionalInsertColumns.forEach((column) => {
        if (normalized.includes(column) && column in nextPayload) {
            delete nextPayload[column];
            removedAny = true;
        }
    });

    const discoveredColumn = extractMissingColumn(normalized);
    if (discoveredColumn && discoveredColumn in nextPayload) {
        delete nextPayload[discoveredColumn];
        removedAny = true;
    }

    return { nextPayload, removedAny };
};

const isDuplicateInsertError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('duplicate key')
        || normalized.includes('ux_attendance_checkin_per_shift_day')
        || normalized.includes('ux_attendance_checkin_per_day');
};

const insertWithLegacyPayloadFallback = async (payload: Record<string, string | number>): Promise<void> => {
    let workingPayload = { ...payload };
    let lastMessage = '';

    for (let attempt = 0; attempt < 12; attempt += 1) {
        const { error } = await supabase.from(tableName).insert([workingPayload]);
        if (!error) {
            return;
        }

        if (isDuplicateInsertError(error.message)) {
            throw new Error(duplicateCheckInMessage);
        }

        lastMessage = error.message;
        const { nextPayload, removedAny } = removeColumnsByMessage(workingPayload, error.message);
        if (!removedAny) {
            throw error;
        }
        workingPayload = nextPayload;
    }

    throw new Error(lastMessage || saveFailedMessage);
};

export const appAttendanceService = {
    async recordCheckIn(
        employee: AppEmployee,
        selectedShift: ShiftDefinition,
        kioskId: string,
        graceMinutes: number,
        checkInPhotoUrl = '',
    ): Promise<AttendanceSummaryRecord> {
        const now = new Date();
        const nowIso = now.toISOString();
        const todayKey = dayKeyBangkok(nowIso);
        const lateMinutes = lateMinutesForCheckIn(now, selectedShift, graceMinutes);
        const status: 'On Time' | 'Late' = lateMinutes > 0 ? 'Late' : 'On Time';

        const existingRows = await loadRowsFromSupabase(
            { employeeId: employee.id, from: todayKey, to: todayKey },
            { useCache: false },
        ).catch(() => null);
        if (existingRows && hasDuplicateOnDay(existingRows, employee.id, nowIso)) {
            throw new Error(duplicateCheckInMessage);
        }

        const payload: Record<string, string | number> = {
            user_id: employee.id,
            employee_id: employee.id,
            timestamp: nowIso,
            check_in_time: nowIso,
            type: 'check_in',
            attendance_type: 'check_in',
            site_id: kioskId,
            site: kioskId,
            kiosk_id: kioskId,
            site_name: 'QR Kiosk',
            lat: 0,
            lng: 0,
            photo_url: checkInPhotoUrl || '',
            status,
            shift_name: selectedShift.id,
            shift: selectedShift.id,
        };

        try {
            await insertWithLegacyPayloadFallback(payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error || '');
            if (message === duplicateCheckInMessage || isDuplicateInsertError(message)) {
                throw new Error(duplicateCheckInMessage);
            }
            throw new Error(saveFailedMessage);
        }

        clearAttendanceCache();

        const remoteRow: NormalizedAttendanceRow = {
            id: `REMOTE-${Date.now()}`,
            employee_id: employee.id,
            timestamp: nowIso,
            status,
            shift_name: selectedShift.id,
            site_id: kioskId,
            type: 'check_in',
            photo_url: checkInPhotoUrl || '',
        };

        return toSummary(remoteRow, [selectedShift], new Map([[employee.id, employee]]), graceMinutes);
    },

    async listCheckIns(
        shifts: ShiftDefinition[],
        employees: AppEmployee[],
        graceMinutes: number,
        filters: AttendanceFilters = {},
    ): Promise<AttendanceSummaryRecord[]> {
        const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
        const remoteRows = await loadRowsFromSupabase(filters);
        return remoteRows.map((row) => toSummary(row, shifts, employeeMap, graceMinutes));
    },

    async deleteCheckIn(recordId: string): Promise<void> {
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq('id', recordId);

        if (error) {
            throw new Error(error.message);
        }

        clearAttendanceCache();
    },
};

